/**
 * Plugin to add audit save functionality to a schema
 * 
 * @param {Schema} schema - Mongoose schema to add the audit save functionality to
 */
export const auditSave = async function (schema) {
  const auditLogPath = schema.path('auditLog');

  if (!auditLogPath || auditLogPath.instance !== 'Array') { throw new Error('Field of "auditLog" as type array required for auditSave plugin'); }

  const itemSchema = auditLogPath.caster?.schema;
  if (!itemSchema) { throw new Error('"auditLog" array field must have a defined schema'); }

  const hasTimestamp = itemSchema.path('timestamp')?.instance === 'Date';
  const hasPerformedBy = itemSchema.path('performedBy')?.instance === 'String';
  const hasAction = itemSchema.path('action')?.instance === 'String';
  if (!hasTimestamp || !hasPerformedBy || !hasAction) {
    throw new Error('"auditLog" must have: - "timestamp" (Date), "performedBy" (String), and "action" (String)');
  }

  schema.methods.auditSave = async function({ performedBy, action } = {}) {
    if (!performedBy || !action) { throw new Error('"performedBy" and "action" parameters required for auditSave'); }
    this.auditLog = this.auditLog || [];
    
    this.auditLog.push({ timestamp: new Date(), performedBy, action });
    await this.save();
  };
}