export function TAG_MODE(tag) {
  return document.createElement(tag)
}
export function TEXT_MODE(text) {
  return document.createTextNode(text)
}
export function ATTRS_MODE(node, attrs) {
  for (let lhs in attrs)
    if (lhs === '_eventsMap') for (let e in attrs._eventsMap) node.addEventListener(e, attrs._eventsMap[e])
    else node.setAttribute(lhs, attrs[lhs])
}
export function COMPONENT_MODE() {}
export function COMPONENT_ARGUMENTS_MODE() {}
export function CHILDREN_MODE() {}
export function emptyContext() {
  return { name: null, factory: null, children: [], args: [] }
}
export function empty() {}
