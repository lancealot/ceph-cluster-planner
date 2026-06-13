import { useEffect, useState } from 'react';

const DISCLAIMERS = [
  "Pricing reflects approximate public list prices at each component's as-of date; actual quotes vary by vendor, region, and volume.",
  'Power numbers are derived from datasheet typical/max ratings, not measured draw; real-world consumption depends on workload, ambient temperature, and PSU efficiency at load.',
  'Capacity uses decimal TB (10^12 bytes). Usable values include BlueStore overhead, EC/replication efficiency, and the configured nearfull ratio — they do not reflect Ceph internal metadata, OMAP growth, or RGW overhead, all of which can reduce usable capacity further.',
  'Validation rules surface common pitfalls but are not exhaustive. Treat warnings as prompts to investigate, not as a substitute for vendor sizing guidance, Ceph upstream documentation, or your own operational runbooks.',
];

export function DisclaimersFooter() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn"
        style={{ border: 'none', background: 'transparent', color: 'var(--text3)', fontSize: 10.5, padding: '4px 8px' }}
      >
        Disclaimers
      </button>
      {open ? (
        <>
          <div className="drawer-scrim" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Disclaimers"
            style={{
              position: 'fixed',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              borderRadius: 7,
              boxShadow: 'var(--shadow)',
              maxWidth: 520,
              maxHeight: '80vh',
              overflowY: 'auto',
              zIndex: 42,
              padding: 18,
            }}
          >
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="microlabel">Disclaimers — read before procurement</span>
              <span className="grow" />
              <button className="btn sm" type="button" onClick={() => setOpen(false)}>Close</button>
            </div>
            <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: 'var(--text2)' }}>
              {DISCLAIMERS.map((d, i) => (
                <li key={i} style={{ marginBottom: 8, lineHeight: 1.5 }}>{d}</li>
              ))}
            </ol>
          </div>
        </>
      ) : null}
    </>
  );
}
