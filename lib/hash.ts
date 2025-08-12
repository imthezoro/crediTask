export function hashString(input: string): string {
  // Fowler–Noll–Vo hash variant for simplicity
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  // Convert to unsigned and hex
  return (hash >>> 0).toString(16);
}


