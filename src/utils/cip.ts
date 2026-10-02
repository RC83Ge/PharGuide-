// Codes des boîtes de médicaments françaises : CIP13 (3400 + 9 chiffres) en EAN-13,
// ou dans un DataMatrix GS1 (01 + 0 + CIP13 + date de péremption + lot).

function isValidEan13(code: string): boolean {
  const sum = code.slice(0, 12).split('').reduce((acc, d, i) => acc + Number(d) * (i % 2 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === Number(code[12]);
}

// Renvoie le CIP13 contenu dans le code lu, ou null si ce n'est pas un code de médicament valide
export function extractCip13(decodedText: string): string | null {
  const digits = decodedText.replace(/\D/g, '');
  const cip13 = digits.match(/3400\d{9}/)?.[0];
  return cip13 && isValidEan13(cip13) ? cip13 : null;
}
