import type { VerificationReport } from './types';

/** Visible banner for anything other than `passed` (spec section 4, "Statuses"). */
export function VerificationBanner({ verification }: { verification: VerificationReport }) {
  if (verification.status === 'passed') return null;
  const failed = verification.status === 'failed';
  const problems = verification.checks.filter((c) => c.status !== 'pass');

  return (
    <div className={`fc-banner fc-banner--${failed ? 'failed' : 'review'}`} role="note" aria-label="Verification status">
      <p className="fc-banner__title">
        <span aria-hidden="true">{failed ? '✕' : '⚠'}</span>{' '}
        {failed ? 'This flowchart did not pass verification.' : 'This flowchart needs a human check.'}
      </p>
      <p className="fc-banner__body">
        {failed
          ? 'Some parts may not match the source text. Check them against the original before relying on this.'
          : 'It has not been fully verified against the source text yet.'}
      </p>
      {problems.length > 0 && (
        <ul className="fc-banner__list">
          {problems.map((check) => (
            <li key={check.name}>
              <strong>{check.status === 'fail' ? 'Failed' : 'Warning'}:</strong> {check.detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
