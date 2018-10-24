import Lexer from './lexer.js'
import VNT from './vnt.js'
import GLOBALS from './globals.js'
import { TEXT_MODE } from './functions.js'

let VNodeCompiler = (function VNodeCompiler(vnt) {
  return function _VNodeCompiler(vnode) {
    return vnt._compile(vnode)
  }
})(new VNT())

function clearDidMounts() {
  if (GLOBALS.didMounts.length) {
    let _didMounts = GLOBALS.didMounts.slice()
    GLOBALS.didMounts = []
    _didMounts.forEach(f => f())
  }
}

function collectComponentsData(dom, unMountOnly) {
  collectWillUnmounts(dom)
  clearWillUnmounts()
  unMountOnly || dom.remove()
}

function collectWillUnmounts(dom) {
  if (dom.nodeType === 3) return
  if (dom.nodeType === 1 && !dom._component && dom.childNodes.length)
    return _collectWillUnmountsfromChildren(dom.childNodes)
  if (dom.nodeType === 1 && dom._component && dom._component.willUnmount) {
    GLOBALS.willUnmounts.push(dom._component.willUnmount.bind(dom._component))
    if (dom.childNodes.length) {
      _collectWillUnmountsfromChildren(dom.childNodes)
    }
  }
}

function _collectWillUnmountsfromChildren(children) {
  let i = 0,
    l = children.length
  while (i < l) {
    collectWillUnmounts(children[i])
    i++
  }
}

function clearWillUnmounts() {
  if (GLOBALS.willUnmounts.length) {
    let _willUnmounts = GLOBALS.willUnmounts.slice()
    GLOBALS.willUnmounts = []
    for (let i = _willUnmounts.length - 1; i > -1; i--) _willUnmounts[i]()
  }
}

function resetUnUsedAttrs(v_attrs, d_attrs, dom) {
  for (let attr in d_attrs) {
    if (attr === '_eventsMap') {
      for (let event in d_attrs._eventsMap) dom.removeEventListener(event, d_attrs._eventsMap[event])
    } else if (!(attr in v_attrs)) dom.removeAttribute(attr)
  }
}

function diffAttrs(v_attrs, d_attrs, dom) {
  for (let attr in v_attrs) {
    if (attr === '_eventsMap') {
      for (let event in v_attrs._eventsMap) dom.addEventListener(event, v_attrs._eventsMap[event])
    } else if (d_attrs[attr] !== v_attrs[attr]) {
      dom.setAttribute(attr, v_attrs[attr])
    }
  }
}

function diffAndUpdateAttrs(vnode, dom) {
  let vnodeAttrs = vnode.attrs ? vnode.attrs.rawValue : {}
  resetUnUsedAttrs(vnodeAttrs, dom._attrs, dom)
  diffAttrs(vnodeAttrs, dom._attrs, dom)
  dom._attrs = vnodeAttrs
}

function replaceDomWithVnode(vnode, dom, parent) {
  let _dom = VNodeCompiler(vnode)
  collectComponentsData(dom, true)
  parent.replaceChild(_dom, dom)
  return _dom
}
function diff(vnode, dom, parent) {
  if (dom && vnode != null) {
    if (dom.nodeType === 1) {
      if (vnode.rawValue === dom._tag) {
        if (vnode.component && dom._component) {
          if (vnode.component.constructor.name === dom._component.constructor.name) {
            dom._component = Object.assign(vnode.component, dom._component)
            dom._component._setDOM(dom)
          } else {
            return replaceDomWithVnode(vnode, dom, parent)
          }
        } else if (vnode.component || dom._component) {
          return replaceDomWithVnode(vnode, dom, parent)
        }
        diffAndUpdateAttrs(vnode, dom)
        if (vnode.children) {
          for (let i = 0; i < vnode.children.length; i++) diff(vnode.children[i], dom.childNodes[i], dom)
        }
        let dcl = dom.childNodes.length,
          vcl = vnode.children ? vnode.children.length : 0
        if (dcl > vcl) while (dcl-- > vcl) collectComponentsData(dom.childNodes[dcl])
      } else {
        return replaceDomWithVnode(vnode, dom, parent)
      }
    } else if (dom.nodeType === 3 && vnode.parsingMode === TEXT_MODE) {
      if (vnode.rawValue !== dom.nodeValue) dom.nodeValue = vnode.rawValue
    } else {
      return replaceDomWithVnode(vnode, dom, parent)
    }
  } else if (dom == null && vnode) {
    parent.appendChild(VNodeCompiler(vnode))
  }
}

export function render(component, DOM) {
  if (typeof component === 'function') {
    let componentInstance
    componentInstance = new component()
    GLOBALS.appInstance = componentInstance
    if (!componentInstance._isHybridButterflyComponent) throw new Error(`${component.name} must extend Component`)
    let lexer = new Lexer()
    let vnt = new VNT()
    if (!DOM || !(DOM && DOM.appendChild)) throw new Error(`render second argument must be a DOM element`)
    DOM.appendChild(vnt.compile(vnt.build(lexer.lex(componentInstance.template(), componentInstance, component.name))))
    clearDidMounts()
    return
  }
  throw new Error(`render first argument must be a class/constructor`)
}

// export class Component {
//   constructor() {
//     this.components = {}
//     this._isHybridButterflyComponent = true
//   }
//   updateView() {
//     let lexer = new Lexer()
//     let vnt = new VNT()
//     let template = this.template()
//     let vNodes = vnt.build(lexer.lex(template, this, this.constructor.name))
//     diff(vNodes, this.DOM, this.DOM.parentNode)
//     clearDidMounts()
//   }
//   _setRouterMatch(match) {
//     this.routerMatch = match
//   }
//   _setDOM(DOM) {
//     this.DOM = DOM
//   }
// }

export function Component() {
  this.components = {}
  this._isHybridButterflyComponent = true
}
Component.prototype.updateView = function() {
  let lexer = new Lexer()
  let vnt = new VNT()
  let template = this.template()
  let vNodes = vnt.build(lexer.lex(template, this, this.constructor.name))
  diff(vNodes, this.DOM, this.DOM.parentNode)
  clearDidMounts()
}

Component.prototype._setRouterMatch = function(match) {
  this.routerMatch = match
}

Component.prototype._setDOM = function(DOM) {
  this.DOM = DOM
}
