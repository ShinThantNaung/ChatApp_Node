const logAuditEvent = (event, metadata = {}) => {
    const payload = {
        event,
        at: new Date().toISOString(),
        ...metadata,
    };

    console.warn(`[AUDIT] ${JSON.stringify(payload)}`);
};

module.exports = {
    logAuditEvent,
};
