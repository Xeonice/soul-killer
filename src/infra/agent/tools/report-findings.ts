import { tool } from 'ai'
import { z } from 'zod'

export function createReportFindingsTool(
  classificationValues: string[],
  dimensionValues: string[],
) {
  return tool({
    description: 'Final report after evaluating all dimensions. Reports classification, summary, and the quality status of each dimension.',
    inputSchema: z.object({
      classification: z.enum(classificationValues as [string, ...string[]])
        .describe('The target type classification'),
      origin: z.string().optional().describe('Source work, organization, or era'),
      summary: z.string().describe('One paragraph summary of the target'),
      dimensionStatus: z.array(z.object({
        dimension: z.string(),
        qualifiedArticles: z.number(),
        sufficient: z.boolean(),
      })).describe('Quality status for each evaluated dimension'),
    }),
    inputExamples: [{
      input: {
        classification: 'PUBLIC_ENTITY',
        origin: 'Romance of the Three Kingdoms',
        summary: 'Cao Cao was a warlord and statesman during the late Eastern Han dynasty.',
        dimensionStatus: [
          { dimension: 'identity', qualifiedArticles: 4, sufficient: true },
          { dimension: 'quotes', qualifiedArticles: 3, sufficient: true },
          { dimension: 'behavior', qualifiedArticles: 2, sufficient: true },
        ],
      },
    }],
    // No execute — calling this tool stops the agent loop.
  })
}
