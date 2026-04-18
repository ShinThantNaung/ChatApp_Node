const { Resend } = require('resend');

const getResendClient = () => {
	const resendApiKey = process.env.RESEND_API_KEY;

	if (!resendApiKey) {
		throw new Error('RESEND_API_KEY is not configured');
	}

	return new Resend(resendApiKey);
};

const resendFromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

module.exports = { getResendClient, resendFromEmail };