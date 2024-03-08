# Installation on Ubuntu 22.04.1 LTS

Run `sudo apt-get install ruby-full build-essential zlib1g-dev`

Add to bashrc:

```
export GEM_HOME="$HOME/gems"
export PATH="$HOME/gems/bin:$PATH"
```

Run `gem install jekyll bundler`

Go to install directory and run:

`bundle install`


Then serve with

`bundle exec jekyll serve --livereload`

If serving in a VM, use:

`bundle exec jekyll server -H 0.0.0.0` to allow external connections
