import './atmosphere.css';

export function BrandAtmosphere({ ocean = true, beacon = true }: { ocean?: boolean; beacon?: boolean }) {
  return <div className="lfb-atmosphere" aria-hidden="true">
    <div className="lfb-atmosphere__aurora" />
    <div className="lfb-atmosphere__mist lfb-atmosphere__mist--one" />
    <div className="lfb-atmosphere__mist lfb-atmosphere__mist--two" />
    {beacon && <div className="lfb-atmosphere__beacon" />}
    {ocean && <div className="lfb-atmosphere__ocean"><i /><i /><i /></div>}
    <div className="lfb-atmosphere__grain" />
  </div>;
}
