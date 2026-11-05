import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { pool, getClient } from './pool.js';
import { resolveEnv } from '../config/index.js';
import { PUBLIC_TEST_TOTP_SECRET, encryptPlaintextSecrets, storeEnrolledSecret } from '../modules/identity/twoFactor.js';

/** Public, well-known test secret. Dev/test only (SE-4 guard above). QA-2 fixed test TOTP secret. */
export const DEV_TOTP_SECRET = PUBLIC_TEST_TOTP_SECRET;

export class SeedRefusedError extends Error {}

/**
 * SE-4: the seed holds a shared demo password and a public TOTP test secret. It runs only when
 * NODE_ENV is explicitly `development` or `test`. An unset or unknown NODE_ENV counts as production
 * (config fail-closed rule), so it is refused too. Production Owners are created with the bootstrap
 * CLI (`src/modules/identity/bootstrap.ts`: random password + one-time 2FA enrollment token).
 */
export function assertSeedAllowed(nodeEnv: string | undefined): void {
  const env = resolveEnv(nodeEnv);
  if (env !== 'development' && env !== 'test') {
    throw new SeedRefusedError(
      'seed.ts refuses to run unless NODE_ENV is development or test (an unset NODE_ENV counts as production). ' +
        'Use the Owner bootstrap CLI in production.'
    );
  }
}

export async function seedDatabase() {
  assertSeedAllowed(process.env.NODE_ENV);
  const client = await getClient();
  try {
    console.log('🌱 Seeding local development data...');
    await client.query('BEGIN');

    // Default password for all local dev accounts: Password123!
    const saltRounds = 10;
    const defaultPasswordHash = await bcrypt.hash('Password123!', saltRounds);

    const employees = [
      {
        email: 'udigity@gmail.com',
        fullName: 'Udigity Admin',
        role: 'owner',
        phone: '+961 1 000 000',
        department: 'Executive',
        jobTitle: 'Owner & System Administrator',
        has2FA: true,
      },
      {
        email: 'karim.saleh@udigity.demo',
        fullName: 'Karim Saleh',
        role: 'data_entry',
        phone: '+000 70 000 102',
        department: 'Operations',
        jobTitle: 'Data Entry Specialist',
        has2FA: false,
      },
      {
        email: 'maya.khoury@udigity.demo',
        fullName: 'Maya Khoury',
        role: 'call_center',
        phone: '+000 70 000 103',
        department: 'Sales',
        jobTitle: 'Senior Outreach Representative',
        has2FA: false,
      },
      {
        email: 'omar.nassar@udigity.demo',
        fullName: 'Omar Nassar',
        role: 'call_center',
        phone: '+000 70 000 104',
        department: 'Sales',
        jobTitle: 'Outreach Representative',
        has2FA: false,
      },
      {
        email: 'lina.aoun@udigity.demo',
        fullName: 'Lina Aoun',
        role: 'developer',
        phone: '+000 70 000 105',
        department: 'Engineering',
        jobTitle: 'Full-Stack Software Engineer',
        has2FA: false,
      },
      {
        email: 'sami.fares@udigity.demo',
        fullName: 'Sami Fares',
        role: 'developer',
        phone: '+000 70 000 106',
        department: 'Engineering',
        jobTitle: 'Frontend & UI Engineer',
        has2FA: false,
      },
    ];

    for (const emp of employees) {
      // Upsert employee
      const { rows: empRows } = await client.query<{ id: string }>(
        `
        INSERT INTO employees (email, full_name, role, phone, department, job_title, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        ON CONFLICT (email) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          phone = EXCLUDED.phone,
          department = EXCLUDED.department,
          job_title = EXCLUDED.job_title,
          is_active = true
        RETURNING id;
        `,
        [emp.email, emp.fullName, emp.role, emp.phone, emp.department, emp.jobTitle]
      );

      const employeeId = empRows[0].id;

      // Upsert credential
      await client.query(
        `
        INSERT INTO credentials (employee_id, password_hash)
        VALUES ($1, $2)
        ON CONFLICT (employee_id) DO UPDATE SET
          password_hash = EXCLUDED.password_hash;
        `,
        [employeeId, defaultPasswordHash]
      );

      // Owner 2FA for dev/test only: the public test secret, stored encrypted (AU-13) like any other.
      if (emp.has2FA) {
        await storeEnrolledSecret(client, employeeId, DEV_TOTP_SECRET);
      }
    }

    // Encrypt any plaintext secret left from before migration 010 (AU-13).
    await encryptPlaintextSecrets(client);

    await client.query('COMMIT');
    console.log('✅ Seed completed successfully: 6 employees created with Password123!');
    console.log('🔑 Owner 2FA uses the public dev/test secret (see DEV_TOTP_SECRET in seed.ts); never in production.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedDatabase()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await pool.end();
      process.exit(1);
    });
}
