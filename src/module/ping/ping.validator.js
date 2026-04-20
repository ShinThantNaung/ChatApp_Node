const { z } = require('zod');

const pingNameSchema = z.string().trim().min(3, 'Ping name must be at least 3 characters');

const validatePingName = (title) => {
	if (typeof title !== 'string' || title.trim() === '') {
		throw new Error('Ping name is required');
	}

	const parsed = pingNameSchema.safeParse(title);
	if (!parsed.success) {
		throw new Error(parsed.error.issues?.[0]?.message || 'Ping name is invalid');
	}

	return parsed.data;
};

module.exports = {
	validatePingName,
};
