# Setting up Discourse for a Performant Studio organization

## Config

Discourse is configured entirely in the org metadata fields in Clerk.

First you'll need to set up a fresh Discourse server and then configure [DiscourseConnect](https://meta.discourse.org/t/setup-discourseconnect-official-single-sign-on-for-discourse-sso/13045?tl=en). Make a note of the secret key generated during this process. Next, create an API key tied to the system user. 

Once the fields below have been entered into your org's metadata, members will be able to sign into Discourse via Performant Studio and org admins will be able to manage the list of Discourse groups via the Performant Studio UI.

### Private metadata

```json
{
  "discourse": {
    "apiKey": "Discourse API key goes here",
    "secret": "DiscourseConnect secret goes here"
  }
}
```

### Public metadata

```json
{
  "discourse": {
    "domain": "mydiscourse.com"
  }
}
```

## Groups

Performant Studio's admin UI simplifies the management of Discourse groups to make it more user-friendly to support private subforums managed by certain users.

Technically, Discourse subforums (known as "categories") and Discourse "groups" (which are better thought of as roles) are managed in separate places in the Discourse UI and making a private subforum is really tricky/tedious for someone without a PhD in Discourse.

Here we use the term group in the sense of a Facebook Group, i.e. the collective whole of a category, a group assigned 1:1 to the category, and its owners/moderators.

When you create a group in the Performant Studio UI, the `discourse-groups` edge function will automatically:

1. Create a Discourse category by that name
2. Create a Discourse group by that name
3. Create a second Discourse group by that name plus "Moderators"
4. Add each member to the selected group(s)
5. Set the category to be private and viewable only by the groups from steps 2 and 3
6. Set the category to be moderated by the moderators group
