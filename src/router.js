import createHistory from 'history/createBrowserHistory'
import pathToRegexp from 'path-to-regexp'

const _history = createHistory()
const { Component } = window.hybridButterfly

_history.listen(() => {
  window.hybridButterfly.appInstance && window.hybridButterfly.appInstance.updateView()
})

export class RouterView {
  constructor({ path, component, exact, data }) {
    let browserPathname = _history.location.pathname
    let keys = []
    let r = pathToRegexp(path, keys)
    let match = r.exec(browserPathname)
    if (match) {
      let matchData
      if (match.length > 1) {
        let matchKeys = keys.map(k => k.name)
        let matchArray = match.slice(1)
        matchData = matchKeys.reduce((base, curr, i) => {
          base[curr] = matchArray[i]
          return base
        }, {})
      }
      let ci = new component(data)
      ci._setRouterMatch(matchData)
      return ci
    } else if (browserPathname.startsWith(path) && !exact) return new component(data)
    else return {}
  }
}
export class RouterLink extends Component {
  constructor(text, path) {
    super()
    this.text = text
    this.path = path
    this.navigate = this.navigate.bind(this)
  }
  navigate() {
    _history.push(this.path)
  }
  template() {
    return `a(href="javascript:;",@click="navigate()")["${this.text}"]`
  }
}
