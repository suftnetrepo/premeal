export function formatMoney(cents: number): string {
  return `£${(cents / 100).toFixed(2)}`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
