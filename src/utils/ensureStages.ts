export async function ensurePipelineStages(payload: any) {
  const STAGES = [
    { name: 'Draft', key: 'draft', color: '#64748b' },
    { name: 'In Review', key: 'review', color: '#f59e0b' },
    { name: 'Approved', key: 'approved', color: '#0d9488' },
    { name: 'Scheduled', key: 'scheduled', color: '#0f172a' },
    { name: 'Published', key: 'published', color: '#10b981' },
  ]

  try {
    // Find existing stages
    const existing = await payload.find({
      collection: 'pipeline-stages',
      limit: 100,
    })

    const existingKeys = existing.docs.map((doc: any) => doc.key)
    const docs = [...existing.docs]

    for (const stage of STAGES) {
      if (!existingKeys.includes(stage.key)) {
        console.log(`Auto-initializing missing pipeline stage: ${stage.name}`)
        const newStage = await payload.create({
          collection: 'pipeline-stages',
          data: stage,
        })
        docs.push(newStage)
      }
    }

    return docs
  } catch (err) {
    console.error('Error ensuring pipeline stages exist:', err)
    return []
  }
}
