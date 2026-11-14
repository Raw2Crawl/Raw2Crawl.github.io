import { auditTranslations } from './translation-audit.mjs';

const result = await auditTranslations();
console.log(`RU source audit: ${result.translated} translated, ${result.verified} verified, ${result.pending} pending.`);
if (process.argv.includes('--complete') && result.pending) result.errors.push(`Russian edition is incomplete: ${result.pending} documents still pending.`);
if (result.errors.length) throw Error(result.errors.join('\n'));
console.log('Available translations passed mechanical checks; semantic and human reviews are recorded separately.');
