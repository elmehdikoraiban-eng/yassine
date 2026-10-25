// Montant en lettres, mention d'usage au Maroc.
export function inWords(n: number): string {
  const units = ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix", "onze", "douze", "treize", "quatorze", "quinze", "seize"];
  const tens = ["", "dix", "vingt", "trente", "quarante", "cinquante", "soixante", "soixante", "quatre-vingt", "quatre-vingt"];
  const below100 = (x: number): string => {
    if (x <= 16) return units[x]!;
    if (x < 20) return "dix-" + units[x - 10];
    const t = Math.floor(x / 10), u = x % 10;
    if (t === 7 || t === 9) return tens[t] + (u === 1 && t === 7 ? "-et-" : "-") + below100(10 + u);
    if (u === 0) return tens[t] + (t === 8 ? "s" : "");
    return tens[t] + (u === 1 && t !== 8 ? "-et-un" : "-" + units[u]);
  };
  const below1000 = (x: number): string => {
    const h = Math.floor(x / 100), r = x % 100;
    const hs = h === 0 ? "" : h === 1 ? "cent" : units[h] + " cent" + (r === 0 ? "s" : "");
    return [hs, r ? below100(r) : ""].filter(Boolean).join(" ");
  };
  const whole = (x: number): string => {
    if (x === 0) return "zéro";
    const parts: string[] = [];
    const m = Math.floor(x / 1_000_000), k = Math.floor((x % 1_000_000) / 1000), r = x % 1000;
    if (m) parts.push(below1000(m) + " million" + (m > 1 ? "s" : ""));
    if (k) parts.push(k === 1 ? "mille" : below1000(k).replace(/s$/, "") + " mille");
    if (r) parts.push(below1000(r));
    return parts.join(" ");
  };
  const dh = Math.floor(n), cts = Math.round((n - dh) * 100);
  return `${whole(dh)} dirhams${cts ? ` et ${whole(cts)} centimes` : ""}`;
}
