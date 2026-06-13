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
      <button type="button" onClick={() => setOpen(true)} className="btn modal-trigger">
        Disclaimers
      </button>
      {open ? (
        <>
          <div className="drawer-scrim" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="Disclaimers" className="modal">
            <div className="row modal-hd">
              <span className="microlabel">Disclaimers — read before procurement</span>
              <span className="grow" />
              <button className="btn sm" type="button" onClick={() => setOpen(false)}>Close</button>
            </div>
            <ol className="disclaimer-list">
              {DISCLAIMERS.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ol>
          </div>
        </>
      ) : null}
    </>
  );
}
