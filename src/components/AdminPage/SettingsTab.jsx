import { PayPalConfiguration } from "./SettingsTab/PayPalConfiguration";

export function SettingsTab({ paypalMode }) {
  return (
    <div className="space-y-6">
      <PayPalConfiguration paypalMode={paypalMode} />
    </div>
  );
}
