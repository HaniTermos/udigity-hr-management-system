/** Plain wording for the attendance verification mode token (`ip`, `location`, ...), A-08. */
const LABELS: Record<string, string> = {
  none: 'no check',
  ip: 'office network',
  location: 'location',
  either: 'network or location',
  both: 'network and location',
};

export function verificationModeLabel(mode: string | null | undefined): string {
  if (!mode) return 'Mode not recorded';
  return `Checked by ${LABELS[mode] ?? mode.replace(/_/g, ' ')}`;
}
