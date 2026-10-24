/** Free/personal mail providers. Anything else is treated as a company domain (a possible sales lead). */
const FREE_MAIL = new Set([
    "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "rocketmail.com", "hotmail.com", "outlook.com", "live.com", "msn.com",
    "icloud.com", "me.com", "mac.com", "aol.com", "proton.me", "protonmail.com", "pm.me", "yandex.com", "yandex.ru", "gmx.com",
    "gmx.de", "mail.ru", "zoho.com", "tutanota.com", "hey.com", "fastmail.com", "inbox.com", "qq.com", "163.com",
]);

export function isCompanyDomain(domain: string) {
    const d = domain.toLowerCase();
    return !FREE_MAIL.has(d) && !/^(yahoo|hotmail|outlook|live)\.[a-z.]{2,6}$/.test(d);
}
