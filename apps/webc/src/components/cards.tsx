import { useState } from "react";
import { getConfig } from "../lib/config";
import type { Citation, MediaRef, MemberInfo, Order } from "../lib/types";
import { StatusChip, formatTime } from "./common";

/** AI 答案下方的引用来源卡（可展开/收起） */
export function CitationCard({ citations }: { citations: Citation[] }) {
  const [open, setOpen] = useState(false);
  if (citations.length === 0) return null;
  return (
    <div className="mt-2 animate-fadein rounded-xl border border-holo/30 bg-holo/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="pressable flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="flex items-center gap-1.5 text-[11px] text-holo">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          引用来源 · {citations.length} 条
        </span>
        <span className={`text-holo transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="animate-fadein space-y-2 border-t border-holo/20 px-3 py-2">
          {citations.map((c, i) => (
            <div key={i} className="rounded-lg bg-bg900/60 p-2">
              <p className="text-[11px] font-medium text-holo">
                《{c.documentTitle}》 · {c.heading}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink2">{c.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 电商订单业务卡（商品图/物流状态/售后按钮） */
export function OrderCard({ order }: { order: Order }) {
  return (
    <div className="mt-2 animate-fadein overflow-hidden rounded-xl border border-gline bg-card">
      <div className="flex items-center justify-between bg-gold/10 px-3 py-1.5">
        <span className="text-[11px] font-medium text-gold">我的订单</span>
        <span className="font-mono text-[10px] text-ink3">{order.id}</span>
      </div>
      <div className="px-3 py-2.5">
        <div className="flex items-start gap-2.5">
          {/* 商品图占位（演示数据用首字缩略图） */}
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-gline bg-gold/10 text-[15px] font-semibold text-gold">
            {order.thumb ?? order.title.slice(0, 1)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[13px] font-medium text-ink">
                {order.title}
                {order.quantity && order.quantity > 1 ? ` ×${order.quantity}` : ""}
              </p>
              <StatusChip status={order.status} />
            </div>
            {order.spec && <p className="mt-0.5 text-[11px] text-ink3">{order.spec}</p>}
          </div>
        </div>
        {order.logistics && (
          <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-holo/5 px-2 py-1.5 text-[11px] text-holo">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
            {order.logistics}
          </p>
        )}
        <div className="mt-2 flex items-center justify-between">
          {typeof order.amount === "number" ? (
            <span className="font-orb text-[13px] text-gold">¥{order.amount}</span>
          ) : (
            <span />
          )}
          {/* 售后自助按钮（演示态静态展示） */}
          <span className="flex gap-1.5">
            <button type="button" className="pressable rounded-full border border-gline px-2.5 py-1 text-[10.5px] text-gold">
              申请售后
            </button>
            <button type="button" className="pressable rounded-full border border-line px-2.5 py-1 text-[10.5px] text-ink2">
              查看物流
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

/** 电商会员业务卡（积分/优惠券/复购标签） */
export function MemberCard({ member }: { member: MemberInfo }) {
  return (
    <div className="mt-2 animate-fadein overflow-hidden rounded-xl border border-gline bg-gradient-to-br from-bg700 to-bg800">
      <div className="flex items-center justify-between px-3 pt-3">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-gold">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 14.1 7.2 16.6l.9-5.3L4.3 7.6l5.3-.8L12 2z" />
          </svg>
          {member.level}
        </span>
        <span className="font-orb text-[15px] text-goldhi">{member.points} 积分</span>
      </div>
      {typeof member.coupons === "number" && (
        <div className="mt-1.5 px-3 text-[11px] text-goldhi">
          优惠券 <span className="font-orb text-[13px]">{member.coupons}</span> 张可用 · 积分每 100 抵 1 元
        </div>
      )}
      <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
        {member.benefits.map((b) => (
          <span key={b} className="rounded-full bg-gold/10 px-2 py-0.5 text-[10px] text-goldhi">
            {b}
          </span>
        ))}
      </div>
    </div>
  );
}

/** 商品目录业务卡（catalog 列表，如价格咨询） */
export function CatalogCard({ items }: { items: Array<{ sku?: string; name: string; priceYuan?: number }> }) {
  return (
    <div className="mt-2 animate-fadein overflow-hidden rounded-xl border border-gline bg-card">
      <div className="bg-gold/10 px-3 py-1.5 text-[11px] font-medium text-gold">商品与价格</div>
      <div className="divide-y divide-line/60 px-3">
        {items.map((it, i) => (
          <div key={it.sku ?? i} className="flex items-center justify-between py-2 text-[12px]">
            <span className="text-ink">{it.name}</span>
            {typeof it.priceYuan === "number" && (
              <span className="font-orb text-[13px] text-gold">¥{it.priceYuan}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 图片找货商品卡（售前转化：内嵌商品卡片 + 领券购买） */
export function ProductCard({
  product,
}: {
  product: { name: string; spec?: string; priceYuan?: number; tag?: string; thumb?: string; note?: string };
}) {
  return (
    <div className="mt-2 animate-fadein overflow-hidden rounded-xl border border-gline bg-card">
      <div className="flex items-center justify-between bg-gold/10 px-3 py-1.5">
        <span className="text-[11px] font-medium text-gold">图片找货 · 匹配商品</span>
        {product.tag && <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] text-goldhi">{product.tag}</span>}
      </div>
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-gline bg-gold/10 text-[18px] font-semibold text-gold">
          {product.thumb ?? product.name.slice(0, 1)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink">{product.name}</p>
          {product.spec && <p className="mt-0.5 text-[11px] text-ink3">{product.spec}</p>}
          {product.note && <p className="mt-1 text-[11px] leading-relaxed text-ink2">{product.note}</p>}
          <div className="mt-2 flex items-center justify-between">
            {typeof product.priceYuan === "number" && (
              <span className="font-orb text-[15px] text-gold">¥{product.priceYuan}</span>
            )}
            <span className="flex gap-1.5">
              <button type="button" className="pressable rounded-full bg-gold px-3 py-1 text-[10.5px] font-medium text-ongold">
                领券购买
              </button>
              <button type="button" className="pressable rounded-full border border-line px-2.5 py-1 text-[10.5px] text-ink2">
                查看详情
              </button>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** 视频诊断安装步骤卡（视频关键帧比对 → 分步指导） */
export function GuideCard({ guide }: { guide: { title: string; steps: string[]; note?: string } }) {
  return (
    <div className="mt-2 animate-fadein overflow-hidden rounded-xl border border-gline bg-card">
      <div className="flex items-center justify-between bg-holo/10 px-3 py-1.5">
        <span className="text-[11px] font-medium text-holo">视频诊断 · 安装步骤</span>
        <span className="text-[10px] text-ink3">关键帧比对完成</span>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[13px] font-medium text-ink">{guide.title}</p>
        <ol className="mt-2 space-y-1.5">
          {guide.steps.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] leading-relaxed text-ink2">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-holo/15 text-[10px] font-semibold text-holo">
                {i + 1}
              </span>
              {s}
            </li>
          ))}
        </ol>
        {guide.note && <p className="mt-2 rounded-lg bg-warn/10 px-2 py-1.5 text-[11px] text-warn">{guide.note}</p>}
      </div>
    </div>
  );
}

/** 买家侧多模态附件（截图/图片/视频消息内的媒体块，演示数据） */
export function MediaThumb({ media }: { media: MediaRef }) {
  const label = media.type === "screenshot" ? "截图" : media.type === "image" ? "图片" : "视频";
  const icon =
    media.type === "screenshot" ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="4" width="18" height="14" rx="2" />
        <path d="M8 21h8M12 18v3" />
      </svg>
    ) : media.type === "image" ? (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    ) : (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="2" y="5" width="15" height="14" rx="2" />
        <path d="M17 10l5-3v10l-5-3" />
      </svg>
    );
  return (
    <div className="mb-1.5 flex items-center gap-2 rounded-lg bg-ongold/15 px-2.5 py-2">
      <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded-md bg-bg950/25 text-ongold">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11.5px] font-medium">{media.label}</span>
        <span className="mt-0.5 block text-[10px] opacity-75">
          {label}消息{media.meta ? ` · ${media.meta}` : ""} · 已送视觉识别
        </span>
      </span>
    </div>
  );
}

/** 低置信度转人工工单卡 */
export function TicketNoticeCard({ title }: { title: string }) {
  return (
    <div className="mt-2 flex animate-fadein items-start gap-2.5 rounded-xl border border-warn/40 bg-warn/10 p-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-warn/20 text-warn">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      </span>
      <div>
        <p className="text-[12px] font-medium text-warn">已为您转专人处理</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-ink2">{title}</p>
      </div>
    </div>
  );
}

/** 仿微信服务通知卡 */
export function ServiceNoticeCard({
  kind,
  title,
  detail,
  createdAt,
  read,
}: {
  kind: string;
  title: string;
  detail?: string;
  createdAt: string;
  read: boolean;
}) {
  const label =
    kind === "ticket.completed" ? "工单完成通知" : kind === "ticket.accepted" ? "工单受理通知" : "会员权益通知";
  const tone = kind === "ticket.completed" ? "text-go" : kind === "ticket.accepted" ? "text-holo" : "text-gold";
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className={`text-[11px] font-medium ${tone}`}>{label}</span>
        <span className="flex items-center gap-1.5 text-[10px] text-ink3">
          {!read && <span className="h-1.5 w-1.5 rounded-full bg-alert" />}
          {formatTime(createdAt)}
        </span>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[13px] font-medium text-ink">{title}</p>
        {detail && <p className="mt-1 text-[11px] leading-relaxed text-ink2">{detail}</p>}
      </div>
      <div className="border-t border-line px-3 py-1.5 text-[10px] text-ink3">
        {getConfig().brandName} · AI 买家服务前台
      </div>
    </div>
  );
}
