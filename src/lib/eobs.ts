export const eobInclude = {
  vendor: true,
  procedures: { orderBy: { sortOrder: 'asc' as const } },
  attachments: true,
}

export function serializeEob(raw: any) {
  return {
    ...raw,
    billedAmount: Number(raw.billedAmount),
    insurancePaid: Number(raw.insurancePaid),
    adjustmentAmount: Number(raw.adjustmentAmount),
    patientResponsibility: Number(raw.patientResponsibility),
    eobDate: new Date(raw.eobDate),
    serviceStart: raw.serviceStart ? new Date(raw.serviceStart) : null,
    serviceEnd: raw.serviceEnd ? new Date(raw.serviceEnd) : null,
    procedures: (raw.procedures || []).map((p: any) => ({
      ...p,
      billedAmount: Number(p.billedAmount),
      allowedAmount: p.allowedAmount == null ? null : Number(p.allowedAmount),
      insurancePaid: Number(p.insurancePaid),
      patientResponsibility: Number(p.patientResponsibility),
      dateOfService: new Date(p.dateOfService),
    })),
  }
}
