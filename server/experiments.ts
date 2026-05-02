export type Experiment = {
  id: string;
  name: string;
  enabled: boolean;
  variants: Array<{ key: string; weight: number }>;
};

const experiments: Experiment[] = [
  {
    id: "pricing-cta-v1",
    name: "Pricing CTA Copy",
    enabled: true,
    variants: [
      { key: "control", weight: 50 },
      { key: "fast-launch", weight: 50 },
    ],
  },
];

export function listExperiments() {
  return experiments;
}

export function assignVariant(experimentId: string, subjectKey: string) {
  const exp = experiments.find((e) => e.id === experimentId && e.enabled);
  if (!exp) return null;

  const hash = Array.from(`${experimentId}:${subjectKey}`).reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const roll = hash % 100;
  let cursor = 0;
  for (const v of exp.variants) {
    cursor += v.weight;
    if (roll < cursor) return { experimentId, variant: v.key };
  }
  return { experimentId, variant: exp.variants[0]?.key || "control" };
}
