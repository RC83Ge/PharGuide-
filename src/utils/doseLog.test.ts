import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, type DoseEntry, nextSafeTime, parseMaxDailyMg, pruneOldEntries, summarizeLast24h } from './doseLog.ts';
import { LOCAL_MEDICATIONS_DB } from '../data/localMedicationsDb.ts';

test('parseMaxDailyMg lit les doses maximales de la base locale', () => {
  const cases: [string, number | null][] = [
    ['3 000 mg (3 g) par jour - max 4 g sous surveillance', 3000],
    ['6 comprimés par jour (soit 480 mg de phloroglucinol)', 480],
    ["1 200 mg / 24h en automédication (jusqu'à 2 400 mg sur ordonnance)", 1200],
    ["2 g à 3 g par jour chez l'adulte", 3000],
    ['8 à 16 bouffées par 24 heures (selon avis médical)', null],
    ["8 gélules (16 mg) par 24 heures chez l'adulte", 16],
    ["8 sachets ou 16 cuillères à café (80 ml) par 24h chez l'adulte", null],
    ['Variable selon prescription stricte (usuellement 0,5 à 1 mg/kg/jour en cure courte)', null],
    ['0,75 mg à 2 mg par 24 heures (jusqu\'à 4 mg max en milieu psychiatrique)', 2],
    ['1 à 2 sachets (10 g à 20 g) par 24 heures chez l\'adulte', 20000],
    ['2000 mg à 3000 mg par 24 heures chez l\'adulte', 3000],
    ['20 à 40 mg selon indication', 40],
    ['200 µg par jour', 0.2],
    ['', null],
    [undefined as unknown as string, null]
  ];
  for (const [text, expected] of cases) {
    assert.equal(parseMaxDailyMg(text), expected, text);
  }
});

test('parseMaxDailyMg ne plante sur aucune entrée de la base locale', () => {
  for (const med of Object.values(LOCAL_MEDICATIONS_DB)) {
    const mg = parseMaxDailyMg(med.maxDailyDosage?.generalMax);
    assert.ok(mg === null || (Number.isFinite(mg) && mg > 0), med.name);
  }
});

const NOW = 1_800_000_000_000;
const HOUR = 60 * 60 * 1000;
const entry = (doseMg: number, hoursAgo: number, medKey = 'doliprane'): DoseEntry => ({
  id: `${medKey}-${hoursAgo}`, medKey, medName: medKey, doseMg, takenAt: NOW - hoursAgo * HOUR
});

test('summarizeLast24h ne compte que ce médicament sur 24 h glissantes', () => {
  const log = [entry(1000, 1), entry(1000, 7), entry(1000, 25), entry(400, 2, 'advil')];
  const s = summarizeLast24h(log, 'doliprane', 3000, NOW);
  assert.equal(s.totalMg, 2000);
  assert.equal(s.entries.length, 2);
  assert.equal(s.lastTakenAt, NOW - HOUR);
  assert.equal(s.level, 'ok');
});

test('summarizeLast24h signale une dose proche ou dépassée', () => {
  assert.equal(summarizeLast24h([entry(1000, 1), entry(1500, 5)], 'doliprane', 3000, NOW).level, 'near');
  assert.equal(summarizeLast24h([entry(1000, 1), entry(1000, 5), entry(1000, 9)], 'doliprane', 3000, NOW).level, 'near');
  assert.equal(summarizeLast24h([entry(2000, 1), entry(1500, 5)], 'doliprane', 3000, NOW).level, 'over');
  assert.equal(summarizeLast24h([entry(2000, 1)], 'doliprane', null, NOW).level, 'unknown');
});

test('nextSafeTime donne le moment où la prise suivante reste sous le maximum', () => {
  const log = [entry(1000, 2), entry(1000, 10), entry(1000, 20)];
  assert.equal(nextSafeTime(log, 1000, 3000, NOW), NOW - 20 * HOUR + DAY_MS);
  assert.equal(nextSafeTime([entry(1000, 2)], 1000, 3000, NOW), null);
  assert.equal(nextSafeTime([], 5000, 3000, NOW), null);
});

test('pruneOldEntries oublie les prises de plus de 7 jours', () => {
  const kept = pruneOldEntries([entry(1000, 1), entry(1000, 24 * 8)], NOW);
  assert.equal(kept.length, 1);
});
