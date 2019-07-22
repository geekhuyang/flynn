export default function ifDev(fn: () => void) {
	if (process.env.NODE_ENV !== 'production') {
		fn();
	}
}
