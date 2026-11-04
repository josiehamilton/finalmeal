/** "Vancouver" from a city label like "Vancouver, BC, Canada". */
export function cityName(label: string): string {
  return label.split(',')[0]?.trim() || label;
}
