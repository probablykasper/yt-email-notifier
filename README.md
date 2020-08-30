<p align="center">
  <img src="./assets/logo.png" width="64">
</p>
<h1 align="center" style="margin-top:0px">
  YouTube Email Notifier
</h1>
<p align="center">macOS menubar app that emails you YouTube upload notifications</p>

## Installation

Download the `.dmg` file from the Releases section, and install like a normal app.

## Usage

### Setup (readme)
1. Once you open the app, it'll show up in the menubar. Click on the menubar icon and select `Settings`. This will open up the settings page in your browser
2. Click the `Setup` button. Here you'll need to enter two things, and then click `Save`:
    - `API key`: This is for fetching channels/videos from the YouTube API. If something is unclear here, look it up or ask in a GitHub issue.
        1. To obtain this, go to [Google APIs & Services](https://console.developers.google.com/apis/dashboard)
        2. Create a `Project` in the top left here, which you could call whatever you like.
        3. Go to the [Credentials](https://console.developers.google.com/apis/credentials) tab and click `Create Credentials` and `API key`
        4. Now you've got your API key. Optionally, you can restrict the key to only work on the `YouTube Data API v3` and only work for requests coming from your IP
    - `From email`: When you receive emails from YTEM, this will be the email you receive it from. If you own `example.com`, you could for instance put in `noreply@ytem.example.com`. If you don't own a domain name, you should be able to just use `example.com`. This doesn't actually have to be a real email, and you don't need to prove it's yours
3. Whatever your `From email` is, go to your email app and create a filter that makes sure emails from that email don't end up in the spam filter. We're not doing much to prove our emails are legit, so they will likely get stuck in the spam filter (In fact, I've even noticed Google putting itself in the spam filter sometimes)
4. Click `Save` and then `New email`. Enter your actual email, and how often you'd like YTEM to check for new videos. You may add multiple emails
5. Now click `Add channel`, then
    1. Select the email you'd like to be notified on
    2. Enter the channel URL. Because of YouTube API limitations, this URL needs to either have `/channel/` or `/user/` in it, other types won't work. If you got a wrong URL, try clicking on a video from the channel, and then go to the channel page from there
    3. Choose the starting time for what videos you'd like to receive email notifications. For example, if you choose 7 days ago, YTEM will notify you about all the videos uploaded since then (maximum the last 50 videos). You'll only be notified for videos uploaded only after the time you set
6. That's all, hopefully it's worth it!

### Limitations (readme)

YTEM is rough around the edges, and there are things that I could have fixed but didn't bother with:
- Check that you entered valid values. It might not always be obvious what has gone wrong
- It's not supported to add the same channel multiple times
- Since this runs locally, it obviously won't send you email notifications when your computer is off
- To delete an email, you'd have to go into the settings file, which can be found in `~/Library/Application Support/YouTube Email Notifier`.

### Menubar options

- Settings: Open the settings. This opens the browser to a local webserver at `http://localhost:9199`
- Check Now: Check for new videos right now. This also resets the refresh intervals.
- Launch on Startup: Click to enable/disable auto launching on startup
- Exit: Not sure what this one does

## Dev instructions

### Get started

1. Install [Node.js](https://nodejs.org) (Preferably Node.js 12 because later versions result in larger binaries)
2. Run `npm install`

Start:

```sh
npm run start
```

Build:

```sh
npm run build
```

### Publish new version

1. Update CHANGELOG.md and commit
2. Bump the version number, commit and tag
  ```
  npm version <version>
  ```
3. Create GitHub release with release notes
