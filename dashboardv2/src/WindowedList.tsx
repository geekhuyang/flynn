import * as React from 'react';
import { debounce } from 'lodash';

import WindowedListState from './WindowedListState';

function findScrollParent(node: HTMLElement | null): HTMLElement | Window {
	while (node) {
		switch (window.getComputedStyle(node).overflow) {
			case 'auto':
				return node;
			case 'scroll':
				return node;
			default:
				node = node.parentElement;
		}
	}
	return window;
}

type ForceUpdateFunction = (callback: () => void) => void;

export interface ChildrenProps {
	onItemRender: (index: number, node: HTMLElement | null, foceUpdate: ForceUpdateFunction) => void;
	shouldItemRender: (index: number) => boolean;
	getItemDimensions: (index: number) => ItemDimensions | null;
}

export interface Props {
	state: WindowedListState;
	threshold?: number;
	children: (props: ChildrenProps) => React.ReactNode;
}

interface ItemDimensions {
	scrollTop: number;
	top: number;
	height: number;
}

export default function WindowedList({ threshold = 0, children }: Props) {
	const scrollParentRef = React.useMemo<{ current: HTMLElement | Window | null }>(() => ({ current: null }), []);
	const maxRenderedIndexRef = React.useMemo<{ current: number }>(() => ({ current: 0 }), []);
	const listContainerRef = React.useMemo<{ current: HTMLElement | null }>(() => ({ current: null }), []);
	const listContainerBaselinePaddingTopRef = React.useMemo<{ current: number | null }>(() => ({ current: null }), []);
	const upperYBoundRef = React.useMemo<{ current: number | null }>(() => ({ current: null }), []);
	const listItemsRef = React.useMemo<{ current: HTMLElement[] }>(() => ({ current: [] }), []);
	const listItemDimensions = React.useMemo(() => new Map<number, ItemDimensions>(), []);
	const shouldRenderIndices = React.useMemo(() => new Set<number>([0]), []);
	const listItemForceUpdateFns = React.useMemo(() => new Map<number, ForceUpdateFunction>(), []);
	const willUnmountFns = React.useMemo<Array<() => void>>(() => [], []);
	React.useEffect(
		() => {
			return () => {
				willUnmountFns.forEach((fn) => fn());
			};
		},
		[willUnmountFns]
	);

	const shouldItemRender = React.useCallback(
		(index: number): boolean => {
			return shouldRenderIndices.has(index);
		},
		[shouldRenderIndices]
	);
	(window as any).shouldRenderIndices = shouldRenderIndices; // DEBUG

	const getItemDimensions = React.useCallback(
		(index: number): ItemDimensions | null => {
			const dimensions = listItemDimensions.get(index);
			if (dimensions) {
				return dimensions;
			} else {
				return null;
			}
		},
		[listItemDimensions]
	);

	const getContainerPadding = React.useCallback(
		() => {
			if (!listContainerRef.current) return 0;
			const basePadding = listContainerBaselinePaddingTopRef.current || 0;
			return parseFloat(listContainerRef.current.style.paddingTop || '0px') - basePadding;
		},
		[listContainerBaselinePaddingTopRef, listContainerRef]
	);

	const calcScrollHeight = React.useCallback(
		() => {
			const scrollParentNode = scrollParentRef.current;
			if (!scrollParentNode) return 0;
			return scrollParentNode === window
				? window.innerHeight
				: (scrollParentNode as HTMLElement).getClientRects()[0].height;
		},
		[scrollParentRef]
	);

	const calcContainerDimensions = React.useCallback(
		(): ItemDimensions => {
			const empty = { top: 0, height: 0, scrollTop: 0 };
			const node = listContainerRef.current;
			if (!node) return empty;
			const rect = node.getClientRects()[0];
			if (!rect) return empty;
			return { top: rect.top, height: rect.height, scrollTop: 0 };
		},
		[listContainerRef]
	);

	const getScrollTop = React.useCallback(
		() => {
			if (scrollParentRef.current === null) {
				return 0;
			}
			let scrollTop = 0;
			if (scrollParentRef.current === window) {
				scrollTop = window.scrollY;
			} else {
				scrollTop = (scrollParentRef.current as HTMLElement).scrollTop;
			}
			return scrollTop;
		},
		[scrollParentRef]
	);

	const calcItemDimensions = React.useCallback(
		(index: number): ItemDimensions | null => {
			const scrollTop = getScrollTop();
			const prevDimensions = listItemDimensions.get(index);
			let nextDimensions: ItemDimensions | null = null;
			if (prevDimensions && prevDimensions.height > 0) {
				nextDimensions = {
					top: prevDimensions.top - scrollTop + prevDimensions.scrollTop,
					height: prevDimensions.height,
					scrollTop
				};
				return nextDimensions;
			}

			const node = listItemsRef.current[index];
			if (!node) return null;
			const rect = node.getClientRects()[0];
			if (!rect) return null;
			const style = window.getComputedStyle(node);
			const margin =
				parseFloat(style.getPropertyValue('margin-top')) + parseFloat(style.getPropertyValue('margin-bottom'));
			const dimensions = { top: rect.top, height: rect.height + margin, scrollTop };
			listItemDimensions.set(index, dimensions);
			return dimensions;
		},
		[getScrollTop, listItemDimensions, listItemsRef]
	);

	const renderIndex = React.useCallback(
		(index: number, callback: () => void) => {
			if (shouldRenderIndices.has(index)) {
				// index already rendered
				callback();
				return;
			}
			const renderItem = listItemForceUpdateFns.get(index);
			if (!renderItem) {
				return;
			}
			shouldRenderIndices.add(index);
			// updateContainerPadding();
			renderItem(callback);
		},
		[listItemForceUpdateFns, shouldRenderIndices]
	);

	const unRenderIndex = React.useCallback(
		(index: number, callback: () => void) => {
			if (!shouldRenderIndices.has(index)) {
				// index not currently rendered
				callback();
				return;
			}
			const renderItem = listItemForceUpdateFns.get(index);
			if (!renderItem) return;
			shouldRenderIndices.delete(index);
			// updateContainerPadding();
			renderItem(callback);
		},
		[listItemForceUpdateFns, shouldRenderIndices]
	);

	const updateRenderedItems = React.useCallback(
		() => {
			// TODO: esimate how tall the listContainer should be to render all the items we have and add padding on the bottom for items not currently rendered (so the scroll bar is a more accurate size)

			// const updateContainerPadding = () => {
			// 	if (!listContainerRef.current) return;
			// 	let padding = listContainerBaselinePaddingTopRef.current || 0;
			// 	console.log('updateContainerPadding...');
			// 	for (let i = 0; true; i++) {
			// 		if (shouldRenderIndices.has(i)) {
			// 			break;
			// 		}
			// 		const dimensions = listItemDimensions.get(i);
			// 		if (!dimensions) break;
			// 		console.log('updateContainerPadding', { i, height: dimensions.height });
			// 		padding += dimensions.height;
			// 	}
			// 	listContainerRef.current.style.paddingTop = `${padding}px`;
			// };

			// const renderDevFrame = (frame: number, p: any) => {
			// 	const elementID = `dev-${frame}`;
			// 	let node = document.getElementById(elementID);
			// 	if (!node) {
			// 		node = document.createElement('div');
			// 		node.setAttribute('id', elementID);
			// 		document.body.appendChild(node);
			// 	}
			// 	node.style.position = 'fixed';
			// 	node.style.width = '100%';
			// 	node.style.top = `${p.topY + p.padding}px`;
			// 	node.style.right = '100px';
			// 	node.style.height = `${p.bottomY - p.topY - p.padding * 2}px`;
			// 	node.style.border = `1px solid ${p.color}`;
			// 	node.innerText = p.content || '';
			// };

			const containerDimensions = calcContainerDimensions();
			const containerPadding = getContainerPadding();
			const containerTop = containerDimensions.top - containerPadding;
			const visibleTopY = Math.max(containerTop, 0);
			const visibleBottomY = visibleTopY + calcScrollHeight();
			const render = (fromIndex: number) => {
				const dimensions = calcItemDimensions(fromIndex);

				// Make sure enough items are rendered to fill viewable area
				if (!dimensions) {
					const lastRenderedItemDimensions = calcItemDimensions(maxRenderedIndexRef.current);
					if (lastRenderedItemDimensions) {
						const bottomY = lastRenderedItemDimensions.top + lastRenderedItemDimensions.height;
						if (bottomY < visibleBottomY) {
							renderIndex(fromIndex, () => render(fromIndex + 1));
						}
					}
					return;
				}

				const itemTopY = dimensions.top;
				const itemBottomY = dimensions.top + dimensions.height;

				// renderDevFrame(1, {
				// 	topY: visibleTopY,
				// 	bottomY: visibleBottomY,
				// 	padding: 0,
				// 	color: 'red'
				// });

				// renderDevFrame(fromIndex + 2, {
				// 	topY: itemTopY,
				// 	bottomY: itemBottomY,
				// 	padding: 0,
				// 	color: 'black',
				// 	content: `itemTopY: ${itemTopY} itemBottomY: ${itemBottomY} height: ${itemBottomY - itemTopY}`
				// });

				if (itemBottomY < visibleTopY - threshold) {
					// Remove items that are off top of screen
					if (!(window as any).outOfViewIndices) (window as any).outOfViewIndices = new Set();
					(window as any).outOfViewIndices.add(fromIndex);
					unRenderIndex(fromIndex, () => render(fromIndex + 1));
					return;
				}

				if (itemTopY > visibleBottomY + threshold) {
					// Remove items that are off bottom of screen
					if (!(window as any).outOfViewIndices) (window as any).outOfViewIndices = new Set();
					(window as any).outOfViewIndices.add(fromIndex);
					unRenderIndex(fromIndex, () => render(fromIndex + 1));
					return;
				}

				// item should be on the screen
				if (!(window as any).outOfViewIndices) (window as any).outOfViewIndices = new Set();
				(window as any).outOfViewIndices.delete(fromIndex);
				renderIndex(fromIndex, () => render(fromIndex + 1));
			};
			render(0);
		},
		[
			calcContainerDimensions,
			calcItemDimensions,
			calcScrollHeight,
			getContainerPadding,
			maxRenderedIndexRef,
			renderIndex,
			threshold,
			unRenderIndex
		]
	);
	const updateRenderedItemsDebounced = React.useMemo(
		() => {
			return debounce(updateRenderedItems, 0, { maxWait: 30 });
		},
		[updateRenderedItems]
	);
	React.useLayoutEffect(
		() => {
			updateRenderedItems();
		},
		[updateRenderedItems]
	);
	const handleScroll = React.useCallback(
		() => {
			updateRenderedItemsDebounced();
		},
		[updateRenderedItemsDebounced]
	);
	const mutationObserver = React.useMemo(
		() => {
			return new MutationObserver(() => {
				updateRenderedItemsDebounced();
			});
		},
		[updateRenderedItemsDebounced]
	);
	React.useEffect(
		() => {
			return () => {
				mutationObserver.disconnect();
			};
		},
		[mutationObserver]
	);
	const handleResize = React.useCallback(
		(e: Event) => {
			window.requestAnimationFrame(() => {
				updateRenderedItems();
			});
		},
		[updateRenderedItems]
	);
	const onItemRender = React.useCallback(
		(index: number, node: HTMLElement | null, forceUpdate: ForceUpdateFunction) => {
			listItemForceUpdateFns.set(index, forceUpdate);
			if (node === null) {
				return;
			}
			listItemsRef.current[index] = node;
			if (shouldRenderIndices.has(index)) {
				if (shouldRenderIndices.has(maxRenderedIndexRef.current)) {
					maxRenderedIndexRef.current = Math.max(maxRenderedIndexRef.current, index);
				} else {
					maxRenderedIndexRef.current = index;
				}
			}
			if (scrollParentRef.current === null) {
				const scrollParentNode = findScrollParent(node.parentElement);
				scrollParentRef.current = scrollParentNode;
				scrollParentNode.addEventListener('scroll', handleScroll, false);
				willUnmountFns.push(() => {
					scrollParentNode.removeEventListener('scroll', handleScroll, false);
				});
				scrollParentNode.addEventListener('resize', handleResize, false);
				willUnmountFns.push(() => {
					scrollParentNode.removeEventListener('resize', handleResize, false);
				});
				const resizeNode: HTMLElement = scrollParentNode === window ? document.body : (scrollParentNode as HTMLElement);
				mutationObserver.observe(resizeNode, { attributes: true, childList: true, subtree: true });
			}
			if (upperYBoundRef.current === null) {
				upperYBoundRef.current = node.getClientRects()[0].top;
			}
			if (listContainerRef.current === null) {
				const listContainerNode = node.parentElement;
				if (listContainerNode) {
					listContainerRef.current = listContainerNode;
					const style = window.getComputedStyle(listContainerNode) as any;
					listContainerBaselinePaddingTopRef.current = parseFloat(style['padding-top']);
				}
			}
		},
		[
			handleResize,
			handleScroll,
			listContainerBaselinePaddingTopRef,
			listContainerRef,
			listItemForceUpdateFns,
			listItemsRef,
			maxRenderedIndexRef,
			mutationObserver,
			scrollParentRef,
			shouldRenderIndices,
			upperYBoundRef,
			willUnmountFns
		]
	);
	return <>{children({ onItemRender, shouldItemRender, getItemDimensions })}</>;
}

export interface ItemProps extends ChildrenProps {
	index: number;
	children: (ref: React.MutableRefObject<HTMLElement | null>) => React.ReactNode;
}

export const WindowedListItem = ({ children, index, onItemRender, shouldItemRender, getItemDimensions }: ItemProps) => {
	const [_forceUpdate, _setForceUpdate] = React.useState(false);
	const forceUpdateCallbackRef = React.useMemo<{ current: (() => void) | null }>(() => ({ current: null }), []);
	const forceUpdate = React.useCallback(
		(callback: () => void) => {
			forceUpdateCallbackRef.current = callback;
			_setForceUpdate(!_forceUpdate);
		},
		[_forceUpdate, forceUpdateCallbackRef]
	);
	const ref = React.useMemo<{ current: null | HTMLElement }>(() => ({ current: null }), []);
	React.useLayoutEffect(
		() => {
			onItemRender(index, ref.current, forceUpdate);
			if (forceUpdateCallbackRef.current) {
				let callback = forceUpdateCallbackRef.current;
				forceUpdateCallbackRef.current = null;
				callback();
			}
		},
		[forceUpdate, forceUpdateCallbackRef, getItemDimensions, index, onItemRender, ref]
	);
	if (!shouldItemRender(index)) {
		const dimensions = getItemDimensions(index);
		const height = dimensions ? dimensions.height : 0;
		return (
			<li ref={ref as any} style={{ position: 'relative', height: `${height}px` }}>
				&nbsp;
			</li>
		);
	}
	return <>{children(ref)}</>;
};
