---
# Feel free to add content and custom Front Matter to this file.
# To modify the layout, see https://jekyllrb.com/docs/themes/#overriding-theme-defaults

layout: post
title: Blog Posts
sidebar_hidden: true
---

Rants, reviews, writeups, reactions, and anything else that doesn't qualify as a guide goes here.

{% assign testarray = site.pages | sort: "date" | reverse %}
{% for page in testarray %}
  {%- if page.dir == "/blog/" -%}
    <div class="post-preview">
      <h2><a href="{{ page.url }}">{{ page.title }}</a></h2>
      <div><i>{{ page.date | date_to_long_string: "ordinal", "US" }}</i></div>
      <br />
      {{ page.excerpt }}
      <a href="{{ page.url }}">Read more...</a>
      <hr />
    </div>
  {%- endif -%}
{% endfor %}
