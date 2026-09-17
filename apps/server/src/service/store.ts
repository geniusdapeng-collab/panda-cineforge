/**
 * service · 存储引导（AI 买家服务前台）
 * 表结构由 packages/db 迁移（并行底座代理）落地：c_users/c_conversations/c_messages/
 * c_notifications/c_tickets/c_ticket_events/kb_collections/kb_documents/kb_chunks/
 * kb_sources/demo_orders/demo_members，全部带 RLS（app.workspace_id GUC）。
 * 本模块职责：
 *  - 种子演示数据（幂等：目标表为空才注入；KB 买家须知缺切块则补建）
 *  - Markdown 切块 + 检索索引重建（kb_chunks）
 * 纪律：种子走 owner 池；业务读写一律经 events.ts 的 serviceTx/svcQuery（RLS 事务上下文）。
 */
import { getOwnerPool } from "@workloom/db";

let bootstrapped: Promise<void> | null = null;

/** 幂等引导（每进程一次；失败置空允许下次调用重试，不永久卡死） */
export function ensureServiceSchema(): Promise<void> {
  if (!bootstrapped) {
    bootstrapped = bootstrap().catch((err) => {
      console.warn("[service-c] ensureServiceSchema 引导失败（允许重试）：", err instanceof Error ? err.message : err);
      bootstrapped = null;
      throw err;
    });
  }
  return bootstrapped;
}

interface SqlClient { query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }

async function bootstrap(): Promise<void> {
  const pool = getOwnerPool();
  const client = await pool.connect();
  try {
    await seedDemo(client as unknown as SqlClient);
  } finally {
    client.release();
  }
}

/** 种子：仅当目标数据缺失时注入（演示数据，幂等） */
async function seedDemo(client: SqlClient): Promise<void> {
  const ws = await client.query(`SELECT id FROM workspaces ORDER BY created_at`);
  for (const row of ws.rows) {
    const wsId = String(row.id);
    // KB 买家须知（文档缺失则建；切块缺失则补）
    let doc = (await client.query(
      `SELECT id, version, content_md FROM kb_documents WHERE workspace_id=$1 AND id=$2 LIMIT 1`,
      [wsId, `kbd-${wsId}-notice`],
    )).rows[0];
    if (!doc) {
      const colId = `kbc-${wsId}-welcome`;
      await client.query(
        `INSERT INTO kb_collections (id, workspace_id, name, description) VALUES ($1,$2,'买家服务知识库','电商买家常见问题与服务说明（演示种子）') ON CONFLICT (id) DO NOTHING`,
        [colId, wsId],
      );
      const md = [
        `# 熊猫优选集团买家服务须知`,
        ``,
        `## 退货政策`,
        `签收次日起 7 天内支持无理由退货（跨境店 30 天），商品完好不影响二次销售即可退，运费险赔付首重。`,
        ``,
        `## 退款时效`,
        `退货验收通过后 24 小时内打款，原路退回，1-3 个工作日到账。`,
        ``,
        `## 物流时效`,
        `国内订单 16:00 前付款当日发货，顺丰/中通 48-72 小时送达；跨境订单 7-15 天送达。`,
        ``,
        `## 智能设备配网`,
        `智能设备仅支持 2.4GHz Wi-Fi 网络，配网密码避免特殊字符；多次失败可发报错截图给客服识别错误码。`,
        ``,
        `## 售后服务`,
        `商品故障、退换货或安装问题，请直接在本小程序留言，客服将在 15 分钟内响应并生成工单跟进。`,
      ].join("\n");
      await client.query(
        `INSERT INTO kb_documents (id, workspace_id, collection_id, title, source_kind, content_md, status)
         VALUES ($1,$2,$3,'熊猫优选集团买家服务须知','manual',$4,'active') ON CONFLICT (id) DO NOTHING`,
        [`kbd-${wsId}-notice`, wsId, colId, md],
      );
      doc = (await client.query(
        `SELECT id, version, content_md FROM kb_documents WHERE workspace_id=$1 AND id=$2 LIMIT 1`,
        [wsId, `kbd-${wsId}-notice`],
      )).rows[0];
    }
    if (doc) {
      const chunks = await client.query(
        `SELECT 1 FROM kb_chunks WHERE workspace_id=$1 AND document_id=$2 LIMIT 1`,
        [wsId, String(doc.id)],
      );
      if (chunks.rows.length === 0) {
        await indexChunks(client, wsId, String(doc.id), String(doc.content_md));
      }
    }
    // 电商演示会员/订单（e2e 契约 fixture M-1001/M-1002：不按空表门控——
    // seed.ts 的扩充运行态会先占表导致本 fixture 被跳过（D36 新装环境 e2e 七连挂根因）；
    // INSERT 均 ON CONFLICT DO NOTHING 幂等，无条件执行；
    // 列语义与 scripts/seed.ts 对齐：room_type 承载商品口径「商品名 ×数量」，check_in/check_out 承载下单/签收日期）
    {
      await client.query(
        `INSERT INTO demo_members (member_id, workspace_id, name, phone, tier, points) VALUES
           ('M-1001',$1,'张伟','13800000001','熊猫金卡',2680),
           ('M-1002',$1,'刘芳','13800000002','熊猫银卡',860)
         ON CONFLICT (workspace_id, member_id) DO NOTHING`,
        [wsId],
      );
      await client.query(
        `INSERT INTO demo_orders (order_id, workspace_id, member_id, room_type, check_in, check_out, amount_fen, status) VALUES
           ('OD-20260820-001',$1,'M-1001','磁吸充电宝 10000mAh ×2','2026-08-20','2026-08-22',17800,'已签收'),
           ('OD-20260818-002',$1,'M-1001','折叠收纳箱 55L ×4','2026-08-18','2026-08-19',19600,'已签收'),
           ('OD-20260822-003',$1,'M-1002','氮化镓快充头 65W ×1','2026-08-22','2026-08-25',7900,'配送中')
         ON CONFLICT (workspace_id, order_id) DO NOTHING`,
        [wsId],
      );
    }
  }
}

/** Markdown 切块：按二级标题分段（无标题则整体一块），供检索命中引用 */
export function splitChunks(md: string): Array<{ heading: string; content: string }> {
  const lines = md.split("\n");
  const chunks: Array<{ heading: string; content: string }> = [];
  let heading = "";
  let buf: string[] = [];
  const flush = () => {
    const content = buf.join("\n").trim();
    // 剔除纯标题空块（去掉 # 行后无正文），避免检索误命中空答案
    const body = content.replace(/^#+\s.*$/gm, "").trim();
    if (body) chunks.push({ heading, content: content.slice(0, 2000) });
    buf = [];
  };
  for (const line of lines) {
    if (line.startsWith("## ")) {
      flush();
      heading = line.replace(/^##\s+/, "").trim();
    } else if (line.startsWith("# ")) {
      flush();
      heading = "";
      buf.push(line);
    } else {
      buf.push(line);
    }
  }
  flush();
  return chunks;
}

/** 重建某文档的切块索引（同事务内调用；embedding/keywords 由底座向量化管线补，本层留空） */
export async function indexChunks(
  client: SqlClient,
  workspaceId: string,
  documentId: string,
  contentMd: string,
): Promise<number> {
  await client.query(`DELETE FROM kb_chunks WHERE workspace_id=$1 AND document_id=$2`, [workspaceId, documentId]);
  const chunks = splitChunks(contentMd);
  for (let i = 0; i < chunks.length; i++) {
    await client.query(
      `INSERT INTO kb_chunks (workspace_id, document_id, chunk_index, heading, content)
       VALUES ($1,$2,$3,$4,$5)`,
      [workspaceId, documentId, i, chunks[i]!.heading, chunks[i]!.content],
    );
  }
  return chunks.length;
}
