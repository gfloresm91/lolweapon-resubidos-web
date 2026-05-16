export async function safeUpsert(model, { where, update, create, select = { id: true } }) {
  const existing = await model.findUnique({ where, select });
  const updateData = update || {};

  if (existing) {
    if (!Object.keys(updateData).length) {
      return model.findUnique({ where });
    }

    return model.update({ where, data: updateData });
  }

  try {
    return await model.create({ data: create });
  } catch (error) {
    if (error?.code === "P2002") {
      if (!Object.keys(updateData).length) {
        return model.findUnique({ where });
      }

      return model.update({ where, data: updateData });
    }

    throw error;
  }
}
