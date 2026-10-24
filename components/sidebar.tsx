"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Globe, Home, KeyRound, ListChecks, LogOut, MailWarning, ScrollText, Users } from "lucide-react";
import { logoutAction } from "@/app/(auth)/actions";
import type { Section } from "@/lib/auth/sections";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ElementType; soon?: string; count?: number; section?: Section };

const MAIN: NavItem[] = [
    { href: "/", label: "الرئيسية", icon: Home },
    { href: "/security", label: "فحص المواقع", icon: Globe, section: "sites" },
    { href: "/security/emails", label: "مراقبة الإيميلات", icon: MailWarning, section: "emails" },
    { href: "/security/emails/checks", label: "سجل فحوصات الإيميل", icon: ListChecks, section: "emails" },
    { href: "/certificates", label: "الشهادات", icon: Award, section: "certificates" },
];

const ADMIN: NavItem[] = [
    { href: "/settings/users", label: "الموظفون", icon: Users },
    { href: "/settings/audit", label: "سجل العمليات", icon: ScrollText },
];

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
    const Icon = item.icon;
    return (
        <Link
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
                active ? "bg-white/15 font-medium text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
            )}
        >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">{item.label}</span>
            {item.soon && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">{item.soon}</span>}
            {!!item.count && (
                <span className="min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-semibold text-white" aria-label={`${item.count} جديد`}>
                    {item.count}
                </span>
            )}
        </Link>
    );
}

export function Sidebar({
    name,
    role,
    sections,
    newRequests,
    newBreaches,
}: {
    name: string;
    role: "ADMIN" | "STAFF";
    sections: Record<Section, boolean>;
    newRequests: number;
    newBreaches: number;
}) {
    const pathname = usePathname();
    const isActive = (href: string) =>
        href === "/"
            ? pathname === "/"
            : href === "/security"
              ? pathname === "/security" || (pathname.startsWith("/security/") && !pathname.startsWith("/security/emails"))
              : href === "/security/emails"
                ? pathname.startsWith(href) && !pathname.startsWith("/security/emails/checks")
                : pathname.startsWith(href);
    const main = MAIN.filter((i) => !i.section || sections[i.section]).map((i) =>
        i.href === "/security" ? { ...i, count: newRequests } : i.href === "/security/emails" ? { ...i, count: newBreaches } : i
    );
    const items = role === "ADMIN" ? [...main, ...ADMIN] : main;

    return (
        <>
            {/* Desktop */}
            <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-sidebar p-4 md:flex">
                <div className="mb-6 flex items-center gap-2 px-2">
                    <Image src="/brand/zad-logo-white.svg" alt="زاد" width={64} height={30} priority />
                    <span className="text-xs text-white/60">لوحة التحكم</span>
                </div>
                <nav className="flex flex-1 flex-col gap-1" aria-label="القائمة الرئيسية">
                    {main.map((i) => (
                        <NavLink key={i.href} item={i} active={isActive(i.href)} />
                    ))}
                    {role === "ADMIN" && (
                        <>
                            <p className="mt-5 mb-1 px-3 text-xs text-white/40">الإعدادات</p>
                            {ADMIN.map((i) => (
                                <NavLink key={i.href} item={i} active={isActive(i.href)} />
                            ))}
                        </>
                    )}
                </nav>
                <div className="border-t border-white/10 pt-4">
                    <p className="px-3 text-sm font-medium text-white">{name}</p>
                    <p className="mb-2 px-3 text-xs text-white/50">{role === "ADMIN" ? "مدير" : "موظف"}</p>
                    <Link
                        href="/change-password"
                        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                    >
                        <KeyRound className="size-4" aria-hidden />
                        تغيير كلمة المرور
                    </Link>
                    <form action={logoutAction}>
                        <button
                            type="submit"
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-white/10 hover:text-white"
                        >
                            <LogOut className="size-4" aria-hidden />
                            تسجيل الخروج
                        </button>
                    </form>
                </div>
            </aside>

            {/* Mobile */}
            <header className="bg-sidebar md:hidden">
                <div className="flex items-center justify-between px-4 py-3">
                    <Image src="/brand/zad-logo-white.svg" alt="زاد" width={56} height={26} priority />
                    <form action={logoutAction}>
                        <button type="submit" className="flex items-center gap-1.5 text-sm text-white/80">
                            <LogOut className="size-4" aria-hidden />
                            خروج
                        </button>
                    </form>
                </div>
                <nav className="flex gap-1 overflow-x-auto px-3 pb-3" aria-label="القائمة الرئيسية">
                    {items.map((i) => (
                        <NavLink key={i.href} item={{ ...i, soon: undefined }} active={isActive(i.href)} />
                    ))}
                </nav>
            </header>
        </>
    );
}
