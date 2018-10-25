# hybrid-butterfly

a lightweight library for building UI on the web with a unique but simple syntax, built on top of [butterfly-template](https://github.com/ahmedyoussef70/butterfly-template)

# Get Started

- CDN

```js
<script src="https://cdn.jsdelivr.net/gh/ahmedyoussef70/hybrid-butterfly@latest/dist/hybridButterfly.js"></script>
<script>
  const { Component, render } = window.hybridButterfly;
</script>
```

# Live Demo

[Tour of Heroes (a remake of the original angular example)](https://codesandbox.io/s/6yklz7xmzr)

### hybrid-butterfly is making use of the main [butterfly-template](https://github.com/ahmedyoussef70/butterfly-template)'s building blocks.

## What exactly did hybrid-butterfly add to [butterfly-template](https://github.com/ahmedyoussef70/butterfly-template) ?

- Components/Contexts
  with 2 lifecycle hooks `didMount` `willUnmount`

```js
class HelloWorld extends Component {
  didMount() {}

  willUnmount() {}

  template() {
    return `h1 [ "hello world" ]`
  }
}
```

- Template Binding

```js
class HelloWorld extends Component {
  text = 'hello world'

  template() {
    return `h1 [ {{ text }} ]`
  }
}
```

- If/For Exp.
  for loops also has some special vars in its scope: `counter` `even` `odd`

  _counter_ is a number starting from 0

  _even_ and _odd_ are booleans

```js
class HelloWorld extends Component {
  x = true
  chars = ['a', 'b', 'c']

  template() {
    return `div [
    
      #if (x) [
        #for (char of chars) [
          h1 [ {{ char }} " - " {{ counter }} " - " {{ even }} " - " {{ odd }} ]
        ]
      ]
      
    ]`
  }
}
```

- Components Resolving
  1 - dependencies components must be registered in components property, and then used in the template as a tag

```js
class XComponent extends Component {
  template() {
    return `h1 [ "hello from XComponent" ]`
  }
}

class HelloWorld extends Component {
  components = { XComponent }

  template() {
    return `div [
      XComponent
    ]`
  }
}
```

2 - you can also pass data/functions down to other components

```js
class XComponent extends Component {
  constructor(msg, moreData) {
    super()
    this.msg = msg
    this.moreData = moreData
  }

  template() {
    return `h1 [ {{ msg }} ]`
  }
}

class HelloWorld extends Component {
  components = { XComponent }

  msg = 'hello world'

  template() {
    return `div [
      XComponent ( "hello world", "hmmm" )
      XComponent ( {{ msg }}, 123 )
    ]`
  }
}
```

- Event Handlers

```js
class HelloWorld extends Component {
  log1 = () => console.log('clicked')

  log2 = value => console.log(value)

  log3 = f => () => f('higher order functions')

  template() {
    return `div [
      button (@click="log1()") [ "click me" ]
      input (@keyup="log2(event.value)")
      button (@click={{ log3(log2) }}) [ "click me" ]
    ]
    `
  }
}
```

## How to update the DOM ?

simply call `updateView` on your component

```js
class HelloWorld extends Component {
  msg = 'hello'

  didMount() {
    setTimeout(() => {
      this.msg = 'bye'
      this.updateView()
    }, 1000)
  }

  template() {
    return `h1 [ "${this.msg}" ]`
  }
}
```

## How to render your app to the DOM ?

call `render` with your app entry and the DOM element you want to append your app to

```js
class HelloWorld extends Component {
  msg = 'hello world'

  template() {
    return `h1 [ "${this.msg}" ]`
  }
}

render(HelloWorld, document.querySelector('#app'))
```
