// Standard success envelope: { success: true, data, message }
export const ok = (res, data = null, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, data, message });

export const created = (res, data = null, message = 'Created') => ok(res, data, message, 201);
