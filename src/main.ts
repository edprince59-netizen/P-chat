import './style.css'
import { setupAuth } from './auth'

type Post = {
  id: number
  name: string
  handle: string
  avatar: string
  image: string
  location: string
  caption: string
  likes: number
  liked: boolean
  comments: string[]
  saved: boolean
}

type Chat = {
  id: number
  name: string
  avatar: string
  online: boolean
  messages: { text: string; mine: boolean; time: string; image?: string }[]
}

const posts: Post[] = [
  {
    id: 1,
    name: 'Aline Mukamana',
    handle: 'aline.creates',
    avatar: 'AM',
    image: 'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1100&q=85',
    location: 'Lake Kivu, Rwanda',
    caption: 'A slower morning, a fresh notebook, and a view that makes every idea feel possible. What are you creating this week? ☀️',
    likes: 248,
    liked: false,
    comments: [],
    saved: false,
  },
  {
    id: 2,
    name: 'Jean de Dieu',
    handle: 'jean.builds',
    avatar: 'JD',
    image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1100&q=85',
    location: 'Kigali, Rwanda',
    caption: 'Our little team is turning a big idea into something real. Always happy to meet people building for their communities.',
    likes: 96,
    liked: false,
    comments: [],
    saved: false,
  },
]

const stories = [
  { name: 'Your story', initials: '+', tone: 'story-add' },
  { name: 'Aline', initials: 'AM', tone: 'story-lilac' },
  { name: 'Patrick', initials: 'PK', tone: 'story-amber' },
  { name: 'Maya', initials: 'MN', tone: 'story-green' },
  { name: 'Eric', initials: 'EN', tone: 'story-blue' },
  { name: 'Zuri', initials: 'ZM', tone: 'story-pink' },
]

const chats: Chat[] = [
  {
    id: 1, name: 'Aline Mukamana', avatar: 'AM', online: true,
    messages: [
      { text: 'Hey! I loved your latest project idea.', mine: false, time: '10:31' },
      { text: 'Thank you! I’m looking for a few people to collaborate with.', mine: true, time: '10:32' },
      { text: 'I’d love to hear more about it ✨', mine: false, time: '10:34' },
    ],
  },
  {
    id: 2, name: 'Patrick K.', avatar: 'PK', online: true,
    messages: [
      { text: 'Are you joining the creators meetup this weekend?', mine: false, time: '09:15' },
      { text: 'Yes, see you there!', mine: true, time: '09:20' },
    ],
  },
  {
    id: 3, name: 'Maya N.', avatar: 'MN', online: false,
    messages: [{ text: 'Sent you the photos from the event.', mine: false, time: 'Yesterday' }],
  },
  {
    id: 4, name: 'Eric N.', avatar: 'EN', online: false,
    messages: [{ text: 'That sounds like a great opportunity.', mine: false, time: 'Yesterday' }],
  },
]

const app = document.querySelector<HTMLDivElement>('#app')
let currentView = 'home'
let selectedChatId = 1
let searchQuery = ''
let mobileChatOpen = false
let feedSort: 'for-you' | 'latest' = 'for-you'
let discoverFilter = 'All'
let composerImage = ''
let userStoryText = ''
let activePostMenuId: number | null = null
let toastTimer = 0
const followedPeople = new Set<string>()
const hiddenPosts = new Set<number>()

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }
    return entities[character]
  })
}

function showToast(message: string, kind: 'success' | 'error' = 'success') {
  const toastRoot = app?.querySelector<HTMLDivElement>('#toast-root')
  if (!toastRoot) return
  window.clearTimeout(toastTimer)
  toastRoot.innerHTML = `<div class="app-toast ${kind}" role="status">${escapeHtml(message)}</div>`
  toastTimer = window.setTimeout(() => {
    toastRoot.innerHTML = ''
  }, 3200)
}

function readImageFile(file: File, maxBytes: number): Promise<string> {
  if (!file.type.startsWith('image/')) {
    return Promise.reject(new Error('Choose an image file to attach.'))
  }
  if (file.size > maxBytes) {
    return Promise.reject(new Error(`Choose an image smaller than ${Math.floor(maxBytes / (1024 * 1024))} MB.`))
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('The selected image could not be read.'))
    }, { once: true })
    reader.addEventListener('error', () => reject(new Error('The selected image could not be read.')), { once: true })
    reader.readAsDataURL(file)
  })
}

function icon(name: string) {
  const paths: Record<string, string> = {
    home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
    discover: '<circle cx="11" cy="11" r="7"/><path d="m16 16 5 5M9 13l2-4 4-2-2 4z"/>',
    message: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
    notification: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
    bookmark: '<path d="M6 4h12v17l-6-4-6 4z"/>',
    profile: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8z"/>',
    comment: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/>',
    share: '<path d="M12 16V3m-5 5 5-5 5 5M5 13v7h14v-7"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    send: '<path d="m22 2-7 20-4-9-9-4zM22 2 11 13"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4 1.4-1.1a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2z"/>',
  }
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] ?? ''}</svg>`
}

function avatar(initials: string, tone = '') {
  return `<span class="avatar ${tone}" aria-hidden="true">${escapeHtml(initials)}</span>`
}

function navigationItem(view: string, label: string, iconName: string) {
  return `<button class="nav-link ${currentView === view ? 'active' : ''}" type="button" data-view="${view}">${icon(iconName)}<span>${label}</span>${view === 'messages' ? '<span class="nav-badge">2</span>' : ''}</button>`
}

function postMarkup(post: Post) {
  return `
    <article class="post-card" data-post-id="${post.id}">
      <header class="post-header">
        ${avatar(post.avatar, 'avatar-coral')}
        <div class="post-author"><strong>${escapeHtml(post.name)}</strong><span>${escapeHtml(post.location)} · <span class="post-handle">@${escapeHtml(post.handle)}</span></span></div>
        <button class="icon-button post-more" type="button" data-post-menu="${post.id}" aria-label="More post options" aria-expanded="${activePostMenuId === post.id}">${icon('more')}</button>
        ${activePostMenuId === post.id ? `<div class="post-menu"><button type="button" data-copy-post="${post.id}">Copy post link</button><button type="button" data-hide-post="${post.id}">Hide this post</button></div>` : ''}
      </header>
      ${post.image ? `<img class="post-image" src="${post.image}" alt="Photo shared by ${escapeHtml(post.name)}" loading="lazy" />` : `<div class="text-post-image">${escapeHtml(post.caption)}</div>`}
      <div class="post-tools">
        <div class="post-tool-group">
          <button class="icon-button like-button ${post.liked ? 'liked' : ''}" type="button" data-like="${post.id}" aria-label="${post.liked ? 'Unlike' : 'Like'} post">${icon('heart')}</button>
          <button class="icon-button" type="button" data-focus-comment="${post.id}" aria-label="Comment on post">${icon('comment')}</button>
          <button class="icon-button" type="button" data-share-post="${post.id}" aria-label="Share post">${icon('share')}</button>
        </div>
        <button class="icon-button save-button ${post.saved ? 'saved' : ''}" type="button" data-save="${post.id}" aria-label="${post.saved ? 'Remove saved post' : 'Save post'}">${icon('bookmark')}</button>
      </div>
      <div class="post-details">
        <strong class="like-count">${post.likes.toLocaleString()} likes</strong>
        <p><strong>${escapeHtml(post.handle)}</strong> ${escapeHtml(post.caption)}</p>
        ${post.comments.length ? `<div class="comment-list">${post.comments.map((comment) => `<p><strong>you</strong> ${escapeHtml(comment)}</p>`).join('')}</div>` : ''}
        <button class="comment-link" type="button" data-focus-comment="${post.id}">${post.comments.length ? 'View comments' : 'Add the first comment'}</button>
        <form class="comment-form" data-comment-form="${post.id}">
          <input type="text" name="comment" placeholder="Add a comment..." aria-label="Add a comment" maxlength="240" required />
          <button type="submit">Post</button>
        </form>
      </div>
    </article>
  `
}

function renderHomeView() {
  const visiblePosts = posts.filter((post) => !hiddenPosts.has(post.id))
  const matchingPosts = visiblePosts.filter((post) => {
    const query = searchQuery.toLowerCase()
    return !query || `${post.name} ${post.handle} ${post.caption} ${post.location}`.toLowerCase().includes(query)
  })
  if (feedSort === 'latest') matchingPosts.sort((first, second) => second.id - first.id)
  return `
    <div class="feed-column">
      <section class="stories-card" aria-label="Stories">
        ${stories.map((story, index) => `
          <button class="story" type="button" data-story="${escapeHtml(story.name)}">
            <span class="story-ring ${index === 0 ? 'no-ring' : ''}"><span class="story-avatar ${story.tone}">${escapeHtml(story.initials)}</span></span>
            <span>${escapeHtml(story.name)}</span>
          </button>
        `).join('')}
      </section>

      <section class="composer-card">
        ${avatar('E', 'avatar-brand')}
        <form class="composer-form" id="post-form">
          <input name="post" type="text" placeholder="Share something with your community..." aria-label="Write a post" maxlength="500" required />
          <div class="composer-actions">
            <div class="composer-actions-left">
              <button class="icon-button composer-image-button" type="button" data-composer-image aria-label="Add a photo to your post">${icon('image')}</button>
              <span class="composer-prompt">${icon('image')} <span>${composerImage ? 'Photo ready to share' : 'Share an idea or photo'}</span></span>
              <input class="visually-hidden" type="file" id="composer-image-input" accept="image/*" aria-label="Choose a photo for your post" />
            </div>
            <button class="button-small" type="submit">Share post</button>
          </div>
          ${composerImage ? `<div class="composer-image-preview"><img src="${composerImage}" alt="Selected post preview" /><button type="button" data-remove-composer-image>Remove photo</button></div>` : ''}
        </form>
      </section>

      <div class="feed-heading"><div><span class="section-kicker">Your community</span><h1>${searchQuery ? 'Search results' : 'Community feed'}</h1></div><button class="sort-button" type="button" data-sort-posts aria-label="Change feed order">${feedSort === 'for-you' ? 'For you' : 'Latest'} <span>⌄</span></button></div>
      <div class="post-list">${matchingPosts.length ? matchingPosts.map(postMarkup).join('') : '<div class="empty-card">No posts match that search. Try another name or topic.</div>'}</div>
    </div>
    ${renderRightPanel()}
  `
}

function renderRightPanel() {
  return `
    <aside class="right-rail">
      <section class="welcome-card">
        <div class="welcome-logo-art" role="img" aria-label="P chat logo"><span class="welcome-logo-mark">P</span><span class="welcome-logo-name">P chat</span></div>
        <p class="section-kicker">Welcome to P chat</p>
        <h2>Good things grow together.</h2>
        <p>Find your people, share your ideas, and open the door to new opportunities.</p>
        <button type="button" class="welcome-link" data-auth-open="signup">Build your circle <span>→</span></button>
      </section>
      <section class="right-widget">
        <div class="widget-heading"><h2>People to connect</h2><button type="button" data-view="discover">See all</button></div>
        ${[
          ['MK', 'Maya K.', 'Product designer', 'avatar-green'],
          ['TN', 'Theo N.', 'Photographer', 'avatar-sky'],
          ['SM', 'Sandrine M.', 'Founder', 'avatar-peach'],
        ].map(([initials, name, role, tone]) => `
          <div class="suggestion-row">
            ${avatar(initials, tone)}
            <div class="suggestion-info"><strong>${name}</strong><span>${role}</span></div>
            <button class="follow-button ${followedPeople.has(name) ? 'following' : ''}" type="button" data-follow="${escapeHtml(name)}" aria-pressed="${followedPeople.has(name)}">${followedPeople.has(name) ? 'Following' : 'Follow'}</button>
          </div>
        `).join('')}
      </section>
      <section class="right-widget trend-widget">
        <div class="widget-heading"><h2>Growing conversations</h2>${icon('discover')}</div>
        <button class="trend-row" type="button" data-search="creating"><span>CREATORS · RWANDA</span><strong>#CreativeWork</strong><small>Ideas, projects, and people making things happen.</small></button>
        <button class="trend-row" type="button" data-search="meet"><span>COMMUNITY · RWANDA</span><strong>#OpenToCollaborate</strong><small>Meet someone who complements your vision.</small></button>
      </section>
      <footer class="rail-footer">About · Guidelines · Privacy<br />© ${new Date().getFullYear()} P chat · Connect. Create. Grow.</footer>
    </aside>
  `
}

function renderMessagesView() {
  const selected = chats.find((chat) => chat.id === selectedChatId) ?? chats[0]
  return `
    <section class="messages-layout ${mobileChatOpen ? 'show-chat' : ''}">
      <aside class="chat-list-panel">
        <div class="chat-list-heading"><div><span class="section-kicker">Your conversations</span><h1>Messages</h1></div><button class="icon-button new-message" type="button" data-new-message aria-label="New message">＋</button></div>
        <label class="chat-search">${icon('discover')}<input id="chat-search" type="search" placeholder="Search messages" aria-label="Search messages" /></label>
        <div class="chat-list">
          ${chats.map((chat) => {
            const latest = chat.messages[chat.messages.length - 1]
            return `<button class="chat-list-item ${selected.id === chat.id ? 'selected' : ''}" type="button" data-chat="${chat.id}" data-chat-name="${escapeHtml(chat.name.toLowerCase())}">
              <span class="chat-avatar-wrap">${avatar(chat.avatar, 'avatar-lilac')}${chat.online ? '<i></i>' : ''}</span>
              <span class="chat-list-copy"><strong>${escapeHtml(chat.name)}</strong><span>${escapeHtml(latest.text || (latest.image ? 'Photo' : ''))}</span></span>
              <time>${escapeHtml(latest.time)}</time>
            </button>`
          }).join('')}
        </div>
      </aside>
      <section class="chat-panel">
        <header class="chat-header">
          <button class="icon-button chat-back" type="button" data-chat-back aria-label="Back to conversations">←</button>
          <span class="chat-avatar-wrap">${avatar(selected.avatar, 'avatar-lilac')}${selected.online ? '<i></i>' : ''}</span>
              <div><strong>${escapeHtml(selected.name)}</strong><span>${selected.online ? 'Active now' : 'P chat member'}</span></div>
          <button class="icon-button" type="button" data-conversation-details aria-label="Conversation details">${icon('more')}</button>
        </header>
        <div class="chat-intro">${avatar(selected.avatar, 'avatar-lilac')}<strong>${escapeHtml(selected.name)}</strong><span>You’re connected on P chat</span></div>
        <div class="chat-messages" id="chat-messages">
          ${selected.messages.map((message) => `<div class="message-row ${message.mine ? 'mine' : ''}"><p>${message.image ? `<img class="message-image" src="${message.image}" alt="Image attachment" />` : ''}${message.text ? escapeHtml(message.text) : ''}<time>${escapeHtml(message.time)}</time></p></div>`).join('')}
        </div>
        <form class="chat-compose" id="chat-form">
          <button class="icon-button attachment-button" type="button" data-chat-attachment aria-label="Add attachment">${icon('image')}</button>
          <input class="visually-hidden" type="file" id="chat-attachment-input" accept="image/*" aria-label="Choose an image attachment" />
          <input type="text" name="message" placeholder="Write a message..." aria-label="Write a message" maxlength="500" required />
          <button class="send-button" type="submit" aria-label="Send message">${icon('send')}</button>
        </form>
      </section>
    </section>
  `
}

function renderSavedView() {
  const savedPosts = posts.filter((post) => post.saved)
  return `
    <div class="feed-column saved-view">
      <div class="feed-heading"><div><span class="section-kicker">Your collection</span><h1>Saved posts</h1></div></div>
      <div class="post-list">${savedPosts.length ? savedPosts.map(postMarkup).join('') : '<div class="empty-card">Posts you save will be collected here for later.</div>'}</div>
    </div>
    ${renderRightPanel()}
  `
}

function renderNotificationsView() {
  return `
    <section class="notifications-view">
      <div class="view-title"><span class="section-kicker">Stay in the loop</span><h1>Activity</h1><p>Your P chat notifications will appear here.</p></div>
      <div class="empty-card">You’re all caught up. New likes, replies, and connections will show up here.</div>
    </section>
    ${renderRightPanel()}
  `
}

function renderDiscoverView() {
  const keywords: Record<string, string[]> = {
    Creators: ['creat', 'idea', 'project'],
    Design: ['design', 'visual', 'creative'],
    Technology: ['technology', 'tech', 'build', 'digital'],
    Business: ['business', 'team', 'founder', 'project'],
    Opportunities: ['opportunit', 'collaborat', 'meet', 'looking for'],
  }
  const matchingPosts = posts.filter((post) => {
    if (hiddenPosts.has(post.id)) return false
    if (discoverFilter === 'All') return true
    const searchable = `${post.name} ${post.handle} ${post.caption} ${post.location}`.toLowerCase()
    return (keywords[discoverFilter] ?? []).some((keyword) => searchable.includes(keyword))
  })
  return `
    <section class="discover-view">
      <header class="view-title"><span class="section-kicker">Find your circle</span><h1>Discover people & ideas</h1><p>Explore community posts and meet people building things that matter.</p></header>
      <div class="discover-tags">${['All', 'Creators', 'Design', 'Technology', 'Business', 'Opportunities'].map((label) => `<button type="button" class="discover-chip ${discoverFilter === label ? 'selected' : ''}" data-discover-filter="${label}">${label}</button>`).join('')}</div>
      <div class="discover-grid">${matchingPosts.length ? matchingPosts.map((post) => `<button class="discover-post" type="button" data-discover-post="${post.id}">${post.image ? `<img src="${post.image}" alt="" loading="lazy" />` : `<span class="discover-text-image">${escapeHtml(post.caption)}</span>`}<span>${escapeHtml(post.caption)}</span></button>`).join('') : '<div class="empty-card">No posts in this topic yet. Try another category.</div>'}</div>
    </section>
    ${renderRightPanel()}
  `
}

function renderView() {
  const root = app?.querySelector<HTMLDivElement>('#view-root')
  if (!root) return
  if (currentView === 'messages') root.innerHTML = renderMessagesView()
  else if (currentView === 'discover') root.innerHTML = renderDiscoverView()
  else if (currentView === 'saved') root.innerHTML = renderSavedView()
  else if (currentView === 'notifications') root.innerHTML = renderNotificationsView()
  else root.innerHTML = renderHomeView()
  root.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    image.addEventListener('error', () => {
      const placeholder = document.createElement('div')
      placeholder.className = image.classList.contains('post-image') ? 'post-image-placeholder' : 'discover-image-placeholder'
      placeholder.textContent = image.alt || 'P chat community photo'
      image.replaceWith(placeholder)
    }, { once: true })
  })
  app?.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === currentView)
  })
}

if (app) {
  app.innerHTML = `
    <div class="social-app">
      <header class="app-topbar">
        <a href="/" class="app-brand" aria-label="P chat home"><span class="app-brand-mark">P</span><span>P chat</span></a>
        <label class="global-search">${icon('discover')}<input id="global-search" type="search" placeholder="Search people, posts, and opportunities" aria-label="Search P chat" /></label>
        <div class="topbar-actions"><button class="icon-button top-notification" type="button" data-view="notifications" aria-label="Notifications">${icon('notification')}<i></i></button><div class="nav-actions"><button class="btn btn-secondary" type="button" data-auth-open="login">Log in</button><button class="btn btn-primary" type="button" data-auth-open="signup">Join P chat</button></div></div>
      </header>
      <div class="app-layout">
        <aside class="left-sidebar">
          <button class="create-button" type="button" data-create-post><span>＋</span> Create a post</button>
          <nav class="side-nav" aria-label="Main navigation">
            ${navigationItem('home', 'Home feed', 'home')}
            ${navigationItem('discover', 'Discover', 'discover')}
            ${navigationItem('messages', 'Messages', 'message')}
            ${navigationItem('notifications', 'Notifications', 'notification')}
            ${navigationItem('saved', 'Saved posts', 'bookmark')}
          </nav>
          <div class="sidebar-divider"></div>
          <div class="sidebar-heading">YOUR SPACE</div>
          <button class="nav-link" type="button" data-auth-open="account">${icon('profile')}<span>My profile</span></button>
          <div class="sidebar-bottom"><div class="sidebar-tagline">Connect.<br />Create.<br /><strong>Grow.</strong></div><span>Vision. Interaction.<br />Media. Opportunities.</span></div>
        </aside>
        <main class="main-content">
          <div class="mobile-page-title"><h1>P chat</h1><button class="icon-button" type="button" data-auth-open="account">${icon('profile')}</button></div>
          <div id="view-root"></div>
        </main>
      </div>
      <nav class="mobile-nav" aria-label="Mobile navigation">
        ${navigationItem('home', 'Home', 'home')}
        ${navigationItem('discover', 'Discover', 'discover')}
        ${navigationItem('messages', 'Messages', 'message')}
        ${navigationItem('notifications', 'Activity', 'notification')}
        <button class="nav-link" type="button" data-auth-open="account">${icon('profile')}<span>Profile</span></button>
      </nav>
      <div id="auth-root"></div>
      <div id="overlay-root"></div>
      <div id="toast-root" aria-live="polite" aria-atomic="true"></div>
    </div>
  `

  const overlayRoot = app.querySelector<HTMLDivElement>('#overlay-root')
  renderView()

  app.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const viewButton = event.target.closest<HTMLButtonElement>('[data-view]')
    if (viewButton) {
      const requested = viewButton.dataset.view ?? 'home'
      if (['home', 'discover', 'messages', 'saved', 'notifications'].includes(requested)) {
        currentView = requested
        mobileChatOpen = false
        if (overlayRoot) overlayRoot.innerHTML = ''
        renderView()
      }
      return
    }

    const likeButton = event.target.closest<HTMLButtonElement>('[data-like]')
    if (likeButton) {
      const post = posts.find((entry) => entry.id === Number(likeButton.dataset.like))
      if (post) {
        post.liked = !post.liked
        post.likes += post.liked ? 1 : -1
        renderView()
        showToast(post.liked ? 'You liked this post.' : 'Like removed.')
      }
      return
    }

    const saveButton = event.target.closest<HTMLButtonElement>('[data-save]')
    if (saveButton) {
      const post = posts.find((entry) => entry.id === Number(saveButton.dataset.save))
      if (post) {
        post.saved = !post.saved
        renderView()
        showToast(post.saved ? 'Post saved to your collection.' : 'Post removed from your collection.')
      }
      return
    }

    const menuButton = event.target.closest<HTMLButtonElement>('[data-post-menu]')
    if (menuButton) {
      const id = Number(menuButton.dataset.postMenu)
      activePostMenuId = activePostMenuId === id ? null : id
      renderView()
      return
    }

    const copyButton = event.target.closest<HTMLButtonElement>('[data-copy-post]')
    if (copyButton) {
      const id = Number(copyButton.dataset.copyPost)
      const link = new URL(window.location.href)
      link.hash = `post-${id}`
      activePostMenuId = null
      renderView()
      if (!navigator.clipboard?.writeText) {
        showToast('This browser does not allow copying links.', 'error')
        return
      }
      void navigator.clipboard.writeText(link.toString()).then(
        () => showToast('Post link copied.'),
        () => showToast('Could not copy the post link. Check browser clipboard permissions.', 'error'),
      )
      return
    }

    const hideButton = event.target.closest<HTMLButtonElement>('[data-hide-post]')
    if (hideButton) {
      const id = Number(hideButton.dataset.hidePost)
      hiddenPosts.add(id)
      activePostMenuId = null
      renderView()
      showToast('Post hidden from your feed.')
      return
    }

    const shareButton = event.target.closest<HTMLButtonElement>('[data-share-post]')
    if (shareButton) {
      const id = Number(shareButton.dataset.sharePost)
      const post = posts.find((entry) => entry.id === id)
      if (!post) return
      const link = new URL(window.location.href)
      link.hash = `post-${id}`
      if (navigator.share) {
        void navigator.share({ title: `P chat post by ${post.name}`, text: post.caption, url: link.toString() })
          .then(() => showToast('Post shared.'))
          .catch((error: unknown) => {
            if (error instanceof Error && error.name !== 'AbortError') showToast('Could not share this post.', 'error')
          })
      } else if (navigator.clipboard?.writeText) {
        void navigator.clipboard.writeText(link.toString()).then(
          () => showToast('Post link copied.'),
          () => showToast('Could not copy the post link. Check browser clipboard permissions.', 'error'),
        )
      } else {
        showToast('Sharing is not available in this browser.', 'error')
      }
      return
    }

    if (event.target.closest('[data-sort-posts]')) {
      feedSort = feedSort === 'for-you' ? 'latest' : 'for-you'
      renderView()
      return
    }

    if (event.target.closest('[data-create-post]')) {
      currentView = 'home'
      renderView()
      app?.querySelector<HTMLInputElement>('#post-form input[name="post"]')?.focus()
      return
    }

    if (event.target.closest('[data-composer-image]')) {
      app?.querySelector<HTMLInputElement>('#composer-image-input')?.click()
      return
    }

    if (event.target.closest('[data-remove-composer-image]')) {
      composerImage = ''
      renderView()
      return
    }

    if (event.target.closest('[data-chat-attachment]')) {
      app?.querySelector<HTMLInputElement>('#chat-attachment-input')?.click()
      return
    }

    if (event.target.closest('[data-new-message]')) {
      if (overlayRoot) {
        overlayRoot.innerHTML = `<div class="action-overlay" data-action-close><section class="action-dialog" role="dialog" aria-modal="true" aria-labelledby="new-message-title"><button class="action-close" type="button" data-action-close aria-label="Close">×</button><span class="section-kicker">Start a conversation</span><h2 id="new-message-title">New message</h2><p>Choose a P chat member from your demo conversations.</p><div class="action-list">${chats.map((chat) => `<button type="button" data-start-chat="${chat.id}">${avatar(chat.avatar, 'avatar-lilac')}<span>${escapeHtml(chat.name)}</span><span>Message →</span></button>`).join('')}</div></section></div>`
        overlayRoot.querySelector<HTMLButtonElement>('[data-start-chat]')?.focus()
      }
      return
    }

    if (event.target.closest('[data-conversation-details]')) {
      const chat = chats.find((entry) => entry.id === selectedChatId)
      if (chat && overlayRoot) {
        overlayRoot.innerHTML = `<div class="action-overlay" data-action-close><section class="action-dialog" role="dialog" aria-modal="true" aria-labelledby="conversation-title"><button class="action-close" type="button" data-action-close aria-label="Close">×</button><span class="section-kicker">Conversation</span><h2 id="conversation-title">${escapeHtml(chat.name)}</h2><p>${chat.online ? 'Active now' : 'P chat member'} · ${chat.messages.length} messages in this local preview.</p><button class="btn btn-secondary" type="button" data-action-close>Done</button></section></div>`
        overlayRoot.querySelector<HTMLButtonElement>('.action-close')?.focus()
      }
      return
    }

    const discoverFilterButton = event.target.closest<HTMLButtonElement>('[data-discover-filter]')
    if (discoverFilterButton) {
      discoverFilter = discoverFilterButton.dataset.discoverFilter ?? 'All'
      renderView()
      return
    }

    const discoverPostButton = event.target.closest<HTMLButtonElement>('[data-discover-post]')
    if (discoverPostButton) {
      const id = Number(discoverPostButton.dataset.discoverPost)
      currentView = 'home'
      searchQuery = ''
      const search = app?.querySelector<HTMLInputElement>('#global-search')
      if (search) search.value = ''
      renderView()
      window.setTimeout(() => {
        const post = app?.querySelector<HTMLElement>(`[data-post-id="${id}"]`)
        post?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        post?.setAttribute('tabindex', '-1')
        post?.focus({ preventScroll: true })
      }, 0)
      return
    }

    const commentFocusButton = event.target.closest<HTMLButtonElement>('[data-focus-comment]')
    if (commentFocusButton) {
      commentFocusButton.closest('.post-card')?.querySelector<HTMLInputElement>('.comment-form input')?.focus()
      return
    }

    const storyButton = event.target.closest<HTMLButtonElement>('[data-story]')
    if (storyButton && overlayRoot) {
      const storyName = storyButton.dataset.story ?? 'Community'
      const ownStory = storyName === 'Your story'
      overlayRoot.innerHTML = `<div class="story-overlay" role="dialog" aria-modal="true" aria-label="${escapeHtml(storyName)} story"><button class="story-close" type="button" aria-label="Close story">×</button><div class="story-progress"><span></span></div><div class="story-viewer"><div class="story-user">${avatar(ownStory ? 'P' : storyName.slice(0, 2).toUpperCase(), 'avatar-lilac')}<strong>${escapeHtml(storyName)}</strong><small>P chat story · local preview</small></div><div class="story-content"><span>✳</span><h2>${ownStory ? (userStoryText ? escapeHtml(userStoryText) : 'Your story starts here.') : 'Good things grow when we share them.'}</h2><p>Connect. Create. Grow.</p></div>${ownStory ? `<form id="story-form" class="story-reply-form"><input name="story" type="text" maxlength="160" placeholder="Share a short story update..." aria-label="Your story update" required /><button type="submit">Share story</button></form>` : '<button class="story-reply" type="button" data-view="messages">Reply to story…</button>'}</div></div>`
      overlayRoot.querySelector<HTMLInputElement>('#story-form input')?.focus()
    }

    if (event.target.matches('[data-action-close]') && overlayRoot) overlayRoot.innerHTML = ''

    const startChatButton = event.target.closest<HTMLButtonElement>('[data-start-chat]')
    if (startChatButton) {
      selectedChatId = Number(startChatButton.dataset.startChat)
      currentView = 'messages'
      mobileChatOpen = true
      if (overlayRoot) overlayRoot.innerHTML = ''
      renderView()
      app?.querySelector<HTMLInputElement>('#chat-form input[name="message"]')?.focus()
      return
    }

    const trend = event.target.closest<HTMLButtonElement>('[data-search]')
    if (trend) {
      searchQuery = trend.dataset.search ?? ''
      currentView = 'home'
      const search = app?.querySelector<HTMLInputElement>('#global-search')
      if (search) search.value = searchQuery
      renderView()
      return
    }

    const followButton = event.target.closest<HTMLButtonElement>('[data-follow]')
    if (followButton) {
      const name = followButton.dataset.follow
      if (!name) return
      const followed = followedPeople.has(name)
      if (followed) followedPeople.delete(name)
      else followedPeople.add(name)
      followButton.textContent = followed ? 'Follow' : 'Following'
      followButton.classList.toggle('following', !followed)
      followButton.setAttribute('aria-pressed', String(!followed))
      showToast(followed ? `You unfollowed ${name}.` : `You’re now following ${name}.`)
      return
    }

    if (event.target.closest('.story-close') || event.target.classList.contains('story-overlay')) {
      if (overlayRoot) overlayRoot.innerHTML = ''
    }
  })

  app.addEventListener('submit', (event) => {
    const form = event.target
    if (!(form instanceof HTMLFormElement)) return
    event.preventDefault()
    const data = new FormData(form)

    if (form.id === 'post-form') {
      const input = form.elements.namedItem('post')
      if (!(input instanceof HTMLInputElement)) return
      const caption = input.value.trim()
      if (!caption) return
      posts.unshift({
        id: Date.now(), name: 'P chat member', handle: 'yourname', avatar: 'P',
        image: composerImage, location: 'Your community', caption, likes: 0, liked: false, comments: [], saved: false,
      })
      composerImage = ''
      searchQuery = ''
      renderView()
      showToast('Your post was added to this local preview.')
      return
    }

    if (form.id === 'chat-form') {
      const input = form.elements.namedItem('message')
      if (!(input instanceof HTMLInputElement)) return
      const text = input.value.trim()
      const chat = chats.find((entry) => entry.id === selectedChatId)
      if (!text || !chat) return
      const now = new Date()
      chat.messages.push({ text, mine: true, time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}` })
      renderView()
      showToast('Message added to this local preview.')
      return
    }

    if (form.id === 'story-form') {
      const storyText = String(data.get('story') ?? '').trim()
      if (!storyText) return
      userStoryText = storyText
      if (overlayRoot) overlayRoot.innerHTML = ''
      showToast('Your story was added to this local preview.')
      return
    }

    const commentPost = form.dataset.commentForm
    if (commentPost) {
      const input = data.get('comment')
      if (typeof input === 'string' && input.trim()) {
        const post = posts.find((entry) => entry.id === Number(commentPost))
        if (post) {
          post.comments.push(input.trim())
          renderView()
          showToast('Comment added to this local preview.')
        }
      }
    }
  })

  app.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return
    const chatButton = event.target.closest<HTMLButtonElement>('[data-chat]')
    if (chatButton) {
      selectedChatId = Number(chatButton.dataset.chat)
      mobileChatOpen = true
      renderView()
      return
    }

    if (event.target.closest('[data-chat-back]')) {
      mobileChatOpen = false
      renderView()
      return
    }

    if (event.target.matches('[data-action-close]') || event.target.closest('.story-close') || event.target.classList.contains('story-overlay')) {
      if (overlayRoot) overlayRoot.innerHTML = ''
    }
  })

  app.querySelector<HTMLInputElement>('#global-search')?.addEventListener('input', (event) => {
    const input = event.currentTarget
    if (!(input instanceof HTMLInputElement)) return
    searchQuery = input.value.trim()
    currentView = 'home'
    renderView()
    const search = app?.querySelector<HTMLInputElement>('#global-search')
    if (search) {
      search.focus()
      search.setSelectionRange(search.value.length, search.value.length)
    }
  })

  app.addEventListener('input', (event) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement) || input.id !== 'chat-search') return
    const query = input.value.trim().toLowerCase()
    app?.querySelectorAll<HTMLButtonElement>('.chat-list-item').forEach((item) => {
      item.hidden = !item.dataset.chatName?.includes(query)
    })
  })

  app.addEventListener('change', (event) => {
    const input = event.target
    if (!(input instanceof HTMLInputElement) || input.type !== 'file') return
    const file = input.files?.[0]
    if (!file) return

    if (input.id === 'composer-image-input') {
      void readImageFile(file, 5 * 1024 * 1024).then((image) => {
        const draft = app?.querySelector<HTMLInputElement>('#post-form input[name="post"]')?.value ?? ''
        composerImage = image
        renderView()
        const draftInput = app?.querySelector<HTMLInputElement>('#post-form input[name="post"]')
        if (draftInput) {
          draftInput.value = draft
          draftInput.focus()
        }
      }).catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : 'Could not add this image.', 'error')
      }).finally(() => {
        input.value = ''
      })
      return
    }

    if (input.id === 'chat-attachment-input') {
      void readImageFile(file, 2 * 1024 * 1024).then((image) => {
        const chat = chats.find((entry) => entry.id === selectedChatId)
        if (!chat) return
        const now = new Date()
        chat.messages.push({
          text: '',
          image,
          mine: true,
          time: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
        })
        renderView()
        showToast('Image attached in this local preview.')
      }).catch((error: unknown) => {
        showToast(error instanceof Error ? error.message : 'Could not attach this image.', 'error')
      }).finally(() => {
        input.value = ''
      })
    }
  })

  app.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlayRoot) overlayRoot.innerHTML = ''
  })

  setupAuth(app)
}
