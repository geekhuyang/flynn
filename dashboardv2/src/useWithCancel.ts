import * as React from 'react';

type CancelFunction = () => void;

export default function useWithCancel() {
	const cancelFns = React.useMemo(() => new Map<string, CancelFunction>(), []);
	const ref = React.useMemo(
		() => ({
			set: (key: string, fn: CancelFunction) => {
				cancelFns.set(key, fn);
			},
			call: (key: string) => {
				const fn = cancelFns.get(key) || (() => {});
				fn();
			},
			current: null
		}),
		[cancelFns]
	);
	return ref;
}
