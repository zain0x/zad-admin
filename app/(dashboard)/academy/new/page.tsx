import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireSection } from "@/lib/auth/permissions";
import { toAmmanLocal } from "@/lib/academy";
import { LectureForm } from "../lecture-form";

export const metadata: Metadata = { title: "محاضرة جديدة" };

export default async function NewLecturePage() {
    await requireSection("lectures");
    // Default: one week from now at 6 pm Amman
    const d = new Date(Date.now() + 7 * 864e5);
    const startsAt = `${toAmmanLocal(d).slice(0, 10)}T18:00`;
    return (
        <div className="mx-auto max-w-3xl">
            <Link href="/academy" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                <ArrowRight className="size-4" aria-hidden />
                المحاضرات
            </Link>
            <h1 className="mb-6 text-2xl font-bold">محاضرة جديدة</h1>
            <LectureForm
                initial={{
                    titleAr: "",
                    titleEn: "",
                    speaker: "",
                    description: "",
                    startsAt,
                    durationHours: "1.5",
                    mode: "IN_PERSON",
                    location: "",
                    onlineUrl: "",
                    capacity: "40",
                    registrationDeadline: "",
                    status: "PUBLISHED",
                }}
            />
        </div>
    );
}
