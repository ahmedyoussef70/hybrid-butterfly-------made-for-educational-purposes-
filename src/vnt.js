import { TAG_MODE, ATTRS_MODE } from './functions.js'
import GLOBALS from './globals.js'

export default class VNT {
  build(tokens = []) {
    this.tokens = tokens
    this.vnt = []
    this.tokensLength = this.tokens.length
    if (this.tokensLength > 0) {
      this.tokens.forEach(token => {
        if (token.parentToken) {
          let children = token.parentToken.children
          children ? children.push(token) : (token.parentToken.children = [token])
        } else {
          this.vnt.push(token)
        }
      })
      return this.vnt.length > 1 ? this.vnt : this.vnt[0]
    } else throw new Error('VNT error: not enough tokens')
  }
  compile(vnt) {
    if (Object.prototype.toString.call(vnt) === '[object Object]') return this._compile(vnt)
    if (Object.prototype.toString.call(vnt) === '[object Array]')
      throw new Error('VNT error: got more than 1 entry point')
  }
  _compile({ rawValue, attrs, children, parsingMode, component }) {
    let node = parsingMode(rawValue)
    if (component) {
      component._setDOM(node)
      node._component = component
      if (typeof component.didMount === 'function') GLOBALS.didMounts.push(component.didMount.bind(component))
    }
    if (parsingMode === TAG_MODE) node._tag = rawValue
    if (attrs) {
      ATTRS_MODE(node, attrs.rawValue)
      node._attrs = attrs.rawValue
    } else {
      node._attrs = {}
    }
    if (children) children.forEach(child => node.appendChild(this._compile(child)))
    return node
  }
}
