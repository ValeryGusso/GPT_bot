export const tarifRelations = {
  price: true,
  code: true,
  activity: true,
}

export const userRelations = {
  activity: { include: { tarif: true } },
  settings: true,
  context: { include: { context: true } },
  token: true,
}
