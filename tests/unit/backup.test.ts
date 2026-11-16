import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConbhanDB } from '../../src/db/db';
import { importBackup } from '../../src/lib/backup';
import { backupFilename, buildBackup, validateBackup } from '../../src/lib/backup';
import { analyticsFixture } from '../fixtures';

let db: ConbhanDB;
let n = 0;

beforeEach(async () => {
  db = new ConbhanDB(`ConbhanBackupTest-${Date.now()}-${n++}`);
  await db.open();
});

afterEach(async () => {
  db.close();
  await db.delete();
});

describe('backup filename', () => {
  it('uses the conbhan-backup-YYYY-MM-DD.json pattern with local dates', () => {
    expect(backupFilename(new Date(2026, 10, 16, 23, 59))).toBe('conbhan-backup-2026-11-16.json');
    expect(backupFilename(new Date(2026, 0, 5))).toBe('conbhan-backup-2026-01-05.json');
  });
});

describe('buildBackup', () => {
  it('wraps the snapshot with app metadata', () => {
    const snapshot = analyticsFixture();
    const backup = buildBackup(snapshot, new Date('2026-11-16T10:00:00.000Z'));
    expect(backup.app).toBe('Conbhan');
    expect(backup.version).toBe(1);
    expect(backup.exportedAt).toBe('2026-11-16T10:00:00.000Z');
    expect(backup.data.goals).toHaveLength(4);
    expect(backup.data.transactions).toHaveLength(7);
  });
});

describe('validateBackup', () => {
  it('accepts a round-tripped backup and normalizes flags', () => {
    const backup = buildBackup(analyticsFixture());
    const result = validateBackup(JSON.parse(JSON.stringify(backup)));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.goals[0].isDefault).toBe(1);
      expect(result.data.transactions[2].isCleared).toBe(1);
      expect(result.data.goals[0].labelIds).toEqual([]);
    }
  });

  it('rejects a non-Conbhan file and unsupported versions', () => {
    expect(validateBackup({ app: 'Other', version: 1, data: {} }).ok).toBe(false);
    expect(validateBackup({ app: 'Conbhan', version: 99, data: {} }).ok).toBe(false);
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup('not json').ok).toBe(false);
  });

  it('rejects dangling references', () => {
    const backup = buildBackup(analyticsFixture());
    const badGoal = JSON.parse(JSON.stringify(backup)) as typeof backup;
    badGoal.data.goals[1].categoryId = 999;
    expect(validateBackup(badGoal).ok).toBe(false);

    const badLabel = JSON.parse(JSON.stringify(backup)) as typeof backup;
    badLabel.data.goals[1].labelIds = [999];
    expect(validateBackup(badLabel).ok).toBe(false);

    const badTxn = JSON.parse(JSON.stringify(backup)) as typeof backup;
    badTxn.data.transactions[0].goalId = 999;
    expect(validateBackup(badTxn).ok).toBe(false);

    const badTxnCategory = JSON.parse(JSON.stringify(backup)) as typeof backup;
    badTxnCategory.data.transactions[0].categoryId = 999;
    expect(validateBackup(badTxnCategory).ok).toBe(false);
  });

  it('rejects duplicate names, bad amounts and bad dates', () => {
    const duplicate = buildBackup(analyticsFixture());
    duplicate.data.categories[1].name = ' general ';
    expect(validateBackup(duplicate).ok).toBe(false);

    const zero = buildBackup(analyticsFixture());
    zero.data.transactions[0].credits = 0;
    expect(validateBackup(zero).ok).toBe(false);

    const negative = buildBackup(analyticsFixture());
    negative.data.goals[1].targetCredits = -10;
    expect(validateBackup(negative).ok).toBe(false);

    const badDate = buildBackup(analyticsFixture());
    badDate.data.transactions[0].transactionDate = '2026-02-30';
    expect(validateBackup(badDate).ok).toBe(false);

    const badType = buildBackup(analyticsFixture());
    (badType.data.transactions[0] as { type: string }).type = 'transfer';
    expect(validateBackup(badType).ok).toBe(false);
  });

  it('reports readable error messages', () => {
    const backup = buildBackup(analyticsFixture());
    backup.data.transactions[0].credits = 0;
    const result = validateBackup(backup);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.join(' ')).toMatch(/credit/i);
    }
  });
});

describe('importBackup', () => {
  it('replaces existing data in one transaction', async () => {
    const backup = buildBackup(analyticsFixture());
    const counts = await importBackup(db, JSON.stringify(backup));
    expect(counts).toEqual({ categories: 3, labels: 2, goals: 4, transactions: 7 });
    expect(await db.categories.count()).toBe(3);
    expect(await db.goals.count()).toBe(4);
    expect(await db.transactions.count()).toBe(7);
    expect((await db.goals.get(1))!.title).toBe('General Credits');
  });

  it('rejects invalid files without touching the database', async () => {
    const backup = buildBackup(analyticsFixture());
    backup.data.transactions[0].credits = -1;
    await expect(importBackup(db, JSON.stringify(backup))).rejects.toThrow(/invalid|backup/i);
    expect(await db.categories.count()).toBe(1);
    expect(await db.goals.count()).toBe(1);
    expect(await db.transactions.count()).toBe(0);
  });

  it('rejects malformed JSON without touching the database', async () => {
    await expect(importBackup(db, '{oops')).rejects.toThrow(/json|parse|invalid/i);
    expect(await db.categories.count()).toBe(1);
  });

  it('round-trips data exactly', async () => {
    const backup = buildBackup(analyticsFixture());
    await importBackup(db, JSON.stringify(backup));
    const exported = buildBackup({
      categories: await db.categories.toArray(),
      labels: await db.labels.toArray(),
      goals: await db.goals.toArray(),
      transactions: await db.transactions.toArray(),
    });
    expect(exported.data).toEqual(backup.data);
  });

  it('rolls back the whole import when a write fails mid-transaction', async () => {
    const backup = buildBackup(analyticsFixture());
    const spy = vi.spyOn(db.transactions, 'bulkAdd').mockRejectedValueOnce(new Error('boom'));
    await expect(importBackup(db, JSON.stringify(backup))).rejects.toThrow(/boom|abort|transaction/i);
    spy.mockRestore();
    expect(await db.categories.count()).toBe(1);
    expect(await db.goals.count()).toBe(1);
    expect(await db.transactions.count()).toBe(0);
  });

  it('re-seeds the protected defaults when a backup omits them', async () => {
    const backup = buildBackup(analyticsFixture());
    backup.data.goals = backup.data.goals.filter((g) => g.isDefault !== 1);
    backup.data.transactions = backup.data.transactions.filter((t) => t.goalId !== 1);
    const counts = await importBackup(db, JSON.stringify(backup));
    expect(counts.goals).toBe(3);
    const defaults = (await db.goals.toArray()).filter((g) => g.isDefault === 1);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].title).toBe('General Credits');
  });
});
