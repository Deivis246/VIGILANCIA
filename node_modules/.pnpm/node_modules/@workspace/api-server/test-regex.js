function parseOcrDays(segment, labels) {
  const match = segment.match(new RegExp(`(?:${labels.join("|")})\\D{0,16}(\\d{1,3})`, "i"));
  return match ? Math.max(0, Number(match[1])) : null;
}

const segment1 = "Vía central: 2";
console.log("central old:", parseOcrDays(segment1, ["V[IÍ]A CENTRAL", "LINEA CENTRAL", "L[IÍ]NEA CENTRAL"]));

const segment2 = "S. NG: 0";
console.log("ng old:", parseOcrDays(segment2, ["SONDA NASOG[ÁA]STRICA", "SONDA NASOGASTRICA"]));
