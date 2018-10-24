import {
  TAG_MODE,
  TEXT_MODE,
  ATTRS_MODE,
  COMPONENT_MODE,
  COMPONENT_ARGUMENTS_MODE,
  CHILDREN_MODE,
  emptyContext,
  empty
} from './functions.js'

export default class Lexer {
  lex(text, component, componentName, relationsMap, contextMode, ifOrForMode) {
    this.text = text || ''
    this.index = 0
    this.currentLineNumber = 1
    this.tokens = []
    this.relationsMap = relationsMap || []
    this.parsingMode = null
    this.contextMode = contextMode || null
    this.component = component
    this.componentName = componentName
    this.currentComponent = emptyContext()
    this.tagR1 = /[a-zA-Z]/
    this.tagR2 = /-|\d/
    this.whiteSpaceR = /\s/
    this.forLoopR = /#for(?:\s+)?\((?:\s+)?(.+)(?:\s+)of(?:\s+)(.+)(?:\s+)?\)(?:\s+)?\[/g
    this.ifR = /#if(?:\s+)?\((?:\s+)?([\S\s]*?)(?:\s+)?\)(?:\s+)?\[/g
    this.escapeChars = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', v: '\v', "'": "'", '"': '"' }
    while (this.index < this.text.length) {
      let ch = text[this.index]
      if (this.tagR1.test(ch)) {
        if (this.parsingMode === COMPONENT_MODE) this.resovleCurrentComponent()
        this.parsingMode = TAG_MODE
        let token = this.readTag()
        if (this.component && this.component.components && this.component.components[token.rawValue]) {
          this.parsingMode = COMPONENT_MODE
          this.currentComponent.factory = this.component.components[token.rawValue]
          this.currentComponent.name = this.component.components[token.rawValue].name
        } else {
          this.tokens.push(token)
        }
      } else if (this.whiteSpaceR.test(ch)) {
        if (ch === '\n') this.currentLineNumber += 1
        this.index += 1
      } else if (ch === '[') {
        if (this.tokens.length) {
          this.relationsMap.push(this.tokens[this.tokens.length - 1])
          this.contextMode = CHILDREN_MODE
          this.index += 1
        } else {
          this.vizError(this.index, this.index + 1)
          throw new Error(
            `Can not declare children without a parent: line -> ${this.currentLineNumber}, index -> ${
              this.index
            }, char -> ${this.text[this.index]}`
          )
        }
      } else if (ch === ']') {
        if (this.parsingMode === COMPONENT_MODE) this.resovleCurrentComponent()
        this.relationsMap.pop()
        this.contextMode = this.relationsMap.length ? CHILDREN_MODE : null
        this.index += 1
      } else if (ch === "'" || ch === '"') {
        if (this.parsingMode === COMPONENT_MODE) this.resovleCurrentComponent()
        this.parsingMode = TEXT_MODE
        this.tokens.push(this.readText(ch))
      } else if (ch === '(') {
        if (this.parsingMode === COMPONENT_MODE) {
          this.parsingMode = COMPONENT_ARGUMENTS_MODE
          this.readComponentArgs(this.currentComponent.args)
          this.resovleCurrentComponent()
        } else {
          if (this.tokens.length) {
            this.parsingMode = ATTRS_MODE
            this.tokens[this.tokens.length - 1].attrs = this.readAttrs()
          } else {
            this.vizError(this.index, this.index + 1)
            throw new Error(
              `Can not attach attrs on null: ${
                this.contextName ? 'Component -> ' + this.contextName + ',' : ''
              } line -> ${this.currentLineNumber}, index -> ${this.index}, char -> ${this.text[this.index]}`
            )
          }
        }
      } else if (ch === ',') {
        this.index += 1
      } else if (ch === '#') {
        if (this.parsingMode === COMPONENT_MODE) this.resovleCurrentComponent()
        this.forLoopR.lastIndex = this.ifR.lastIndex = this.index
        let res
        if ((res = this.forLoopR.exec(this.text))) {
          let varName = res[1]
          let collectionName = res[2]
          let collectionNameStartIndex = res[0].indexOf(collectionName)
          this.index += collectionNameStartIndex
          let expFunc = this.readStrExp(collectionName)
          this.index += res[0].length - collectionNameStartIndex - collectionName.length
          let index = this.index
          let bodyEndIndex = this.getBodyEndIndex(1)
          let forLoopBody = this.text.slice(index, bodyEndIndex)
          let counter = -1
          let collection = expFunc()
          if (!Array.isArray(collection)) throw new Error(`For loop collection must be an array -> ${collectionName}`)
          for (let x of collection) {
            counter += 1
            let tokens = new Lexer().lex(
              forLoopBody,
              {
                ...this.component,
                [varName]: x,
                even: counter % 2 === 0,
                odd: counter % 2 !== 0,
                counter
              },
              this.componentName,
              this.relationsMap,
              this.contextMode,
              true
            )
            tokens.forEach(t => this.tokens.push(t))
          }
        } else if ((res = this.ifR.exec(this.text))) {
          let ifExp = res[1]
          let ifExpStartIndex = res[0].indexOf(ifExp)
          this.index += ifExpStartIndex
          let ifExpFunc = this.readStrExp(ifExp)
          this.index += res[0].length - ifExpStartIndex - ifExp.length
          let index = this.index
          let bodyEndIndex = this.getBodyEndIndex(1)
          if (ifExpFunc()) {
            let ifBody = this.text.slice(index, bodyEndIndex)
            let tokens = new Lexer().lex(
              ifBody,
              this.component,
              this.componentName,
              this.relationsMap,
              this.contextMode,
              true
            )
            tokens.forEach(t => this.tokens.push(t))
          } else {
            this.index = bodyEndIndex + 1
          }
        } else {
          this.vizError(this.index, this.index + 5)
          throw new Error(
            `Invalid if/for syntax: ${this.componentName ? 'Component -> ' + this.componentName + ',' : ''} line -> ${
              this.currentLineNumber
            }`
          )
        }
      } else if (ch === '{' && this.peak(1) === '{') {
        if (this.parsingMode === COMPONENT_MODE) this.resovleCurrentComponent()
        let { expFunc, startIndex } = this.readExp()
        this.tokens.push(this.makeToken(String(expFunc()), startIndex, TEXT_MODE))
      } else {
        this.vizError(this.index, this.index + 1)
        throw new Error(
          `Unknown char: line -> ${this.currentLineNumber}, index -> ${this.index}, char -> ${this.text[this.index]}`
        )
      }
    }
    if (!ifOrForMode) this.tokens[0].component = this.component
    return this.tokens.length ? this.tokens : []
  }
  readComponentArgs(args) {
    let currentStaticValue = empty
    let currentDynamicValue = empty
    let index = this.index
    this.index += 1
    while (this.parsingMode === COMPONENT_ARGUMENTS_MODE) {
      let ch = this.text[this.index]
      if (ch != null) {
        if (ch === "'" || ch === '"') {
          if (currentStaticValue !== empty) {
            this.vizError(index, this.index)
            throw new Error(
              `Missing comma: ${
                this.componentName ? 'Component -> ' + this.componentName + ',' : ''
              } after -> ${this.text.slice(index, this.index)}`
            )
          }
          this.parsingMode = TEXT_MODE
          let token = this.readText(ch)
          currentStaticValue = token.rawValue
          this.parsingMode = COMPONENT_ARGUMENTS_MODE
        } else if (ch === '{' && this.peak(1) === '{') {
          if (currentDynamicValue !== empty) {
            this.vizError(index, this.index)
            throw new Error(
              `Missing comma: ${
                this.componentName ? 'Component -> ' + this.componentName + ',' : ''
              } after -> ${this.text.slice(index, this.index)}`
            )
          }
          let { expFunc } = this.readExp()
          currentDynamicValue = expFunc()
        } else if (ch === ',' || ch === ')') {
          this.index += 1
          if (currentStaticValue !== empty) {
            args.push(currentStaticValue)
            currentStaticValue = empty
          }
          if (currentDynamicValue !== empty) {
            args.push(currentDynamicValue)
            currentDynamicValue = empty
          }
          if (ch === ')') this.parsingMode = COMPONENT_MODE
        } else if (this.whiteSpaceR.test(ch)) {
          if (ch === '\n') this.currentLineNumber += 1
          this.index += 1
        } else {
          this.vizError(this.index, this.index + 1)
          throw new Error(
            `Unknown char: line -> ${this.currentLineNumber}, index -> ${this.index}, char -> ${this.text[this.index]}`
          )
        }
      } else {
        this.vizError(index, this.index)
        throw new Error(
          `Missing a closing parenthesis: ${
            this.componentName ? 'Component -> ' + this.componentName + ',' : ''
          } text -> ${this.text.slice(index, this.index)}`
        )
      }
    }
  }
  resovleCurrentComponent() {
    let componentClass = this.currentComponent.factory
    let componentArgs = this.currentComponent.args
    let componentInstance = new componentClass(...componentArgs)
    if (componentInstance._isHybridButterflyComponent) {
      let tokens = this.fLexer(componentInstance, componentClass)
      tokens.forEach(t => this.tokens.push(t))
    }
    this.currentComponent = emptyContext()
    this.parsingMode = null
  }
  fLexer(componentInstance, componentClass) {
    return new Lexer().lex(
      componentInstance.template(),
      componentInstance,
      componentClass.name,
      this.relationsMap,
      this.contextMode
    )
  }
  readStrExp(x) {
    let { expFunc } = this.readExp(x.length)
    return expFunc
  }
  getBodyEndIndex(openClosedBrackets) {
    while (openClosedBrackets) {
      let ch = this.text[this.index]
      if (ch != null) {
        if (ch === "'" || ch === '"') {
          let cpm = this.parsingMode
          this.parsingMode = TEXT_MODE
          let token = this.readText(ch)
          this.parsingMode = cpm
          this.index = token.endIndex + 2
        } else if (ch === '[') {
          openClosedBrackets += 1
          this.index += 1
        } else if (ch === ']') {
          openClosedBrackets -= 1
          this.index += 1
        } else {
          this.index += 1
        }
      } else {
        this.vizError(this.index - 3, this.index + 1)
        throw new Error(
          `Missing a closing bracket: ${
            this.componentName ? 'Component -> ' + this.componentName + ',' : ''
          } text -> ${this.text.slice(this.index - 3, this.index + 1)}`
        )
      }
    }
    return this.index - 1
  }
  peak(n) {
    return this.text[this.index + n]
  }
  readTag() {
    let tag = ''
    let index = this.index
    tag += this.text[this.index]
    this.index += 1
    while (this.parsingMode === TAG_MODE) {
      let ch = this.text[this.index]
      if (ch != null && (this.tagR1.test(ch) || this.tagR2.test(ch))) {
        tag += ch
        this.index += 1
      } else {
        let token = this.makeToken(tag, index)
        tag = index = null
        this.parsingMode = null
        return token
      }
    }
  }
  readText(q) {
    let text = ''
    let quote = q
    let index = this.index + 1
    let shouldEscape = false
    this.index += 1
    while (this.parsingMode === TEXT_MODE) {
      let ch = this.text[this.index]
      if (ch != null) {
        if (shouldEscape) {
          text += this.escapeChars[this.text[this.index]] || ch
          this.index += 1
          shouldEscape = false
        } else if (ch === '\\') {
          shouldEscape = true
          this.index += 1
        } else if (ch === quote) {
          let token = this.makeToken(text, index)
          text = index = null
          this.index += 1
          return token
        } else {
          if (ch === '\n') this.currentLineNumber += 1
          text += ch
          this.index += 1
        }
      } else {
        this.vizError(index, this.index - 1)
        throw new Error(
          `Missing quote: line -> ${this.currentLineNumber}, index -> ${this.index}, text -> ${this.text.slice(
            index,
            this.index - 1
          )}`
        )
      }
    }
  }
  readAttrs() {
    let attrs = { _eventsMap: {} }
    let LHS = ''
    let RHS = ''
    let expectingLHS = true
    let expectingRHS = false
    let expectingComma = false
    let eventMode = false
    let index = this.index + 1
    this.index += 1
    while (this.parsingMode === ATTRS_MODE) {
      let ch = this.text[this.index]
      if (ch != null) {
        if (this.whiteSpaceR.test(ch)) {
          if (LHS) expectingComma = true
          if (ch === '\n') this.currentLineNumber += 1
          this.index += 1
        } else if (ch === ',' || ch === ')') {
          if (LHS) {
            if (eventMode) {
              attrs._eventsMap[LHS] = RHS
              eventMode = false
            } else attrs[LHS] = RHS
          }
          LHS = RHS = ''
          expectingRHS = false
          expectingLHS = true
          expectingComma = false
          this.index += 1
          if (ch === ')') {
            let token = this.makeToken(attrs, index)
            this.parsingMode = LHS = RHS = attrs = null
            return token
          }
        } else if (expectingLHS) {
          if (ch === '@') {
            if (expectingComma) {
              this.vizError(index, this.index)
              throw new Error(
                `Missing a comma: ${
                  this.componentName ? 'Component -> ' + this.componentName + ',' : ''
                } text -> ${this.text.slice(index, this.index)}`
              )
            }
            eventMode = true
            this.index += 1
          } else if (this.tagR1.test(ch) || (LHS.length && this.tagR2.test(ch))) {
            if (expectingComma) {
              this.vizError(index, this.index)
              throw new Error(
                `Missing a comma: ${
                  this.componentName ? 'Component -> ' + this.componentName + ',' : ''
                } text -> ${this.text.slice(index, this.index)}`
              )
            }
            LHS += ch
            this.index += 1
          } else if (ch === '=') {
            expectingRHS = true
            expectingLHS = false
            expectingComma = false
            this.index += 1
          } else {
            this.vizError(this.index, this.index + 1)
            throw new Error(
              `Attr keys must not have quotes or curly braces: line -> ${this.currentLineNumber}, index -> ${
                this.index
              }, char -> ${this.text[this.index]}`
            )
          }
        } else if (expectingRHS) {
          if (ch === '{' && this.peak(1) === '{') {
            let { expFunc } = this.readExp()
            RHS = expFunc()
            expectingRHS = false
            expectingLHS = false
            expectingComma = true
          } else if (ch === "'" || ch === '"') {
            this.parsingMode = TEXT_MODE
            let token = this.readText(ch)
            RHS = token.rawValue
            if (eventMode) {
              let index = this.index
              this.index = token.startIndex
              let expFunc = this.readStrExp(RHS)
              this.index = index
              RHS = expFunc
            }
            expectingRHS = false
            expectingLHS = false
            expectingComma = true
            this.parsingMode = ATTRS_MODE
          } else {
            this.vizError(this.index, this.index + 1)
            throw new Error(
              `Attr values must have quotes or curly braces: line -> ${this.currentLineNumber}, index -> ${
                this.index
              }, char -> ${this.text[this.index]}`
            )
          }
        } else if (expectingComma) {
          this.vizError(index, this.index)
          throw new Error(
            `Missing a comma: ${
              this.componentName ? 'Component -> ' + this.componentName + ',' : ''
            } text -> ${this.text.slice(index, this.index)}`
          )
        }
      } else {
        this.vizError(index, this.index)
        throw new Error(
          `Missing a closing parenthesis: ${
            this.componentName ? 'Component -> ' + this.componentName + ',' : ''
          } text -> ${this.text.slice(index, this.index)}`
        )
      }
    }
  }
  readExp(n) {
    let cpm = this.parsingMode
    let { startIndex, vars, exp } = this.getResovableVars(n)
    let resolvedValues = vars.map(x => this.component[x])
    let eventIndex = vars.indexOf('event')
    this.parsingMode = cpm
    return {
      expFunc: callerArgs => {
        if (eventIndex >= 0) resolvedValues[eventIndex] = callerArgs
        try {
          let f = new Function(...vars, `return ${exp}`)
          return f(...resolvedValues)
        } catch (e) {
          this.vizError(startIndex, this.index)
          throw new Error(`${e}`)
        }
      },
      startIndex
    }
  }
  getResovableVars(n) {
    let vars = []
    let cvar = ''
    let index = this.index
    let lastIsDot = false
    let expEnd = false
    let exp = ''
    this.index += n != null ? 0 : 2
    while (!expEnd && (n == null || n > 0)) {
      let ch = this.text[this.index]
      if (ch != null) {
        if (ch === "'" || ch === '"') {
          this.parsingMode = TEXT_MODE
          let token = this.readText(ch)
          exp += ch + token.rawValue + ch
          if (n != null) n -= token.rawValue.length + 2
        } else if ('<>=!|&~[],.()+-/%?:'.includes(ch) || ch >= 0 || ch < 0) {
          if (n != null) n -= 1
          exp += ch
          if (ch === '.') lastIsDot = true
          else lastIsDot = false
          if (cvar) {
            if (cvar === 'false' || cvar === 'true' || cvar === 'NaN' || cvar === 'null' || cvar === 'undefined') {
              cvar = ''
            } else {
              let _cvar = cvar.trim()
              if (vars.indexOf(_cvar) === -1) vars.push(_cvar)
              cvar = ''
            }
          }
          this.index += 1
        } else if (ch === '}' && this.peak(1) === '}') {
          if (cvar) {
            if (cvar === 'false' || cvar === 'true' || cvar === 'NaN' || cvar === 'null' || cvar === 'undefined') {
              cvar = ''
            } else {
              let _cvar = cvar.trim()
              if (vars.indexOf(_cvar) === -1) vars.push(_cvar)
              cvar = ''
            }
          }
          expEnd = true
          this.index += 2
        } else if (ch === '}') {
          this.vizError(index, this.index + 1)
          throw new Error(
            `Missing closing curly braces: ${
              this.componentName ? 'Component -> ' + this.componentName + ',' : ''
            } text -> ${this.text.slice(index, this.index + 1)}`
          )
        } else if (!lastIsDot) {
          if (n != null) n -= 1
          cvar += ch
          exp += ch
          this.index += 1
        } else {
          if (n != null) n -= 1
          exp += ch
          this.index += 1
        }
      } else {
        this.vizError(index, this.index)
        throw new Error(
          `Missing closing curly braces: ${
            this.componentName ? 'Component -> ' + this.componentName + ',' : ''
          } text -> ${this.text.slice(index, this.index)}`
        )
      }
    }
    if (cvar) {
      if (cvar === 'false' || cvar === 'true' || cvar === 'NaN' || cvar === 'null' || cvar === 'undefined') {
        cvar = ''
      } else {
        let _cvar = cvar.trim()
        if (vars.indexOf(_cvar) === -1) vars.push(_cvar)
        cvar = ''
      }
    }
    return { startIndex: index, vars, exp }
  }
  makeToken(rawValue, startIndex, parsingMode) {
    return {
      parsingMode: parsingMode || this.parsingMode,
      contextMode: this.contextMode,
      rawValue,
      startIndex,
      endIndex: this.index - 1,
      lineNumber: this.currentLineNumber,
      parentToken: this.contextMode === CHILDREN_MODE ? this.relationsMap[this.relationsMap.length - 1] : null,
      componentName: this.componentName,
      attrs: null,
      component: null
    }
  }
  vizError(start, end) {
    let body
    if (typeof document === 'object' && (body = document.querySelector('body'))) {
      let error = `<pre>${this.text.slice(0, start)}<b style="color:orangered">${this.text.slice(start, end)}</b></pre>`
      body.innerHTML = error
    }
  }
}
