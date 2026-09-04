base url: https://api.neoxr.eu/api
contoh Endpoint + base url: https://api.neoxr.eu/api/yts?q=komang&apikey=xxxx

API YOUTUBE SEARCH
endpoint: /yts
parameter: q (query)
response: 
{
  "creator": "@neoxr.js – Wildan Izzudin",
  "status": true,
  "data": [
    {
      "type": "video",
      "videoId": "fKRtnMYMW08",
      "url": "https://youtube.com/watch?v=fKRtnMYMW08",
      "title": "KOMANG - RAIM LAODE LYRIC OFFICIAL",
      "description": "Terimaksih sudah menjadi bagian terpenting dalam perjalanan karir saya, ini adalah lagu yang saya lama buatnya, saya harap ...",
      "image": "https://i.ytimg.com/vi/fKRtnMYMW08/hq720.jpg",
      "thumbnail": "https://i.ytimg.com/vi/fKRtnMYMW08/hq720.jpg",
      "seconds": 239,
      "timestamp": "3:59",
      "duration": {
        "seconds": 239,
        "timestamp": "3:59"
      },
      "ago": "3 years ago",
      "views": 226053909,
      "author": {
        "name": "Raim Laode",
        "url": "https://youtube.com/channel/UC6CRezCe1QhJfNpdTOXx5Sg"
      }
    },
total asli hasil dari api /yts: random


API DOWNLOAD YOUTUBE MP3/MP4
endpoint: /youtube
parameter: url, type, quality 
(mp3: url, audio, 128kb) 
(mp4: url, video, 360p/480p/720p/1080p)
response mp3: 
{
  "creator": "@neoxr.js – Wildan Izzudin",
  "status": true,
  "id": "fKRtnMYMW08",
  "title": "KOMANG - RAIM LAODE LYRIC OFFICIAL",
  "thumbnail": "https://i.ytimg.com/vi/fKRtnMYMW08/hqdefault.jpg",
  "duration": "03:59",
  "duration_seconds": 239,
  "channel": "Raim Laode",
  "views": "226.055.113",
  "data": {
    "filename": "KOMANG - RAIM LAODE LYRIC OFFICIAL.mp3",
    "quality": "128kbps",
    "size": "3.7 MB",
    "extension": "mp3",
    "url": "https://secure-signed.pages.dev/token/zlKdlCjlZWEls54CRVk1?domain=neoxr.eu"
  }
}
response mp4:
{
  "creator": "@neoxr.js – Wildan Izzudin",
  "status": true,
  "id": "fKRtnMYMW08",
  "title": "KOMANG - RAIM LAODE LYRIC OFFICIAL",
  "thumbnail": "https://i.ytimg.com/vi/fKRtnMYMW08/hqdefault.jpg",
  "duration": "03:59",
  "duration_seconds": 239,
  "channel": "Raim Laode",
  "views": "226.055.462",
  "data": {
    "filename": "KOMANG - RAIM LAODE LYRIC OFFICIAL.mp4",
    "quality": "720p",
    "size": "20.7 MB",
    "extension": "mp4",
    "url": "https://secure-signed.pages.dev/token/9huUF4TlmqodrvXDenwN?domain=neoxr.eu"
  }
}


API SEARCH SPOTIFY
endpoint: /spotify-search
parameter: q (query)
response:
{
  "creator": "@neoxr.js – Wildan Izzudin",
  "status": true,
  "data": [
    {
      "thumbnail": "https://i.scdn.co/image/ab67616d0000b273e3b3d759e32208f05b45120f",
      "title": "Raim Laode - Komang",
      "duration": "3:43",
      "popularity": "67%",
      "preview": null,
      "url": "https://open.spotify.com/track/3zltzCUqDOxeYQvx3OQiIX"
    }
total asli hasil: 10 (namun tidak selamanya 10)


API SPOTIFY DOWNLOAD
endpoint: /spotify
parameter: url
response:
{
  "creator": "@neoxr.js – Wildan Izzudin",
  "status": true,
  "data": {
    "thumbnail": "https://i.scdn.co/image/ab67616d0000b273916264f005e3e27b19fc9b61",
    "title": "CHOP MAGIA - Super Slowed - CASAP, CHIEF DORO",
    "artist": "CASAP, CHIEF DORO",
    "duration": "01:34",
    "preview": "https://p.scdn.co/mp3-preview/8eecffb7d3f9fcabae965fac21c0483e02511ba4",
    "url": "https://secure-signed.pages.dev/token/lG54QplFMhYOr7cXmWMj?domain=neoxr.eu"
  }
}


API DOWNLOAD TIKTOK
endpoint: /tiktok
parameter: url
response:
{
  "creator": "@neoxr.js – Wildan Izzudin",
  "status": true,
  "data": {
    "id": "7480894024082050309",
    "caption": "lagi cos test mai 😗  #maishiranui #cosplay",
    "author": {
      "id": "6820340003454649346",
      "shortId": "",
      "uniqueId": "nikenandalusi_",
      "nickname": "Niken ♡",
      "avatarLarger": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/09d3c8600f7e6959adda57753d53bfa7~tplv-tiktokx-cropcenter:1080:1080.jpeg?dr=14579&refresh_token=f8b22885&x-expires=1788177600&x-signature=M51xDJKjJKzTy2Vz7b2WR8xmWMo%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
      "avatarMedium": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/09d3c8600f7e6959adda57753d53bfa7~tplv-tiktokx-cropcenter:720:720.jpeg?dr=14579&refresh_token=c89efb8e&x-expires=1788177600&x-signature=BGsjvssHgJr%2BugPDgtNl62sU1RM%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
      "avatarThumb": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/09d3c8600f7e6959adda57753d53bfa7~tplv-tiktokx-cropcenter:100:100.jpeg?dr=14579&refresh_token=0b26bb98&x-expires=1788177600&x-signature=bAu%2Fz00RmwyitPxTFDeZfHUidls%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
      "signature": "real account cuma ini & @nikentut \nendorse/collab: +6287873015290 \nig: @nikenandalusi",
      "createTime": 1587984420,
      "verified": false,
      "secUid": "MS4wLjABAAAATd2eBcGzoJplVlz5CeqsDZLhip7-pohXsKXuDl9jjYhCNeeIDjt6u0yMFl0GwE6A",
      "ftc": false,
      "relation": 0,
      "openFavorite": false,
      "commentSetting": 0,
      "duetSetting": 1,
      "stitchSetting": 1,
      "privateAccount": false,
      "secret": false,
      "isADVirtual": false,
      "roomId": "",
      "uniqueIdModifyTime": 0,
      "ttSeller": false,
      "downloadSetting": 3,
      "recommendReason": "",
      "nowInvitationCardUrl": "",
      "nickNameModifyTime": 0,
      "isEmbedBanned": false,
      "canExpPlaylist": false,
      "suggestAccountBind": false,
      "UserStoryStatus": 0,
      "shortDramaCreator": {}
    },
    "statistic": {
      "likes": 28500,
      "comments": 143,
      "shares": 608900,
      "views": 608900,
      "saved": "11575"
    },
    "music": {
      "id": "7480894019749382967",
      "cover": "https://p16-common-sign.tiktokcdn.com/tos-alisg-avt-0068/09d3c8600f7e6959adda57753d53bfa7~tplv-tiktokx-cropcenter:1080:1080.jpeg?dr=14579&refresh_token=f8b22885&x-expires=1788177600&x-signature=M51xDJKjJKzTy2Vz7b2WR8xmWMo%3D&t=4d5b0474&ps=13740610&shp=a5d48078&shcp=81f88b70&idc=my2",
      "title": "original sound - Niken ♡",
      "author": "Niken ♡",
      "duration": 21,
      "original": true,
      "copyright": true
    },
    "published": "1741781376",
    "photo": false,
    "audio": "https://dl.snapcdn.app/get?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJodHRwczovL3YxOS1pZXMtbXVzaWMudGlrdG9rY2RuLXVzLmNvbS9lOWIzZjNlMDgxMWMwMDgwY2NkMDU0NGQ4YWIyODkwYy82YTljMGQ2My92aWRlby90b3MvdXNlYXN0MmEvdG9zLXVzZWFzdDJhLXYtMjdkY2Q3L29zekZNOFVZZ0kwd1JuM0N2ZVBvaUdZQ293bXFTRXJlZ0VUTGVULz9hPTU4Mzk2NSZidGk9T1VCek9UZzdRR282T2paQUwzQWpMVEF6WUNNeE5ETmcmJmJ0PTEyNSZmdD1uay40aTBzcTE3VHZqU0RYWVN4UnN0QUZNNn5PQkI5QloxbnpYdEcmbWltZV90eXBlPWF1ZGlvX21wZWcmcmM9Wnpvek5XUmxaMmc3TjJVNE9qeG1hVUJwTTJkcWFIazVjak54ZVRNek56VThNMEF5TVRNMk5UTmZYalF4WHk1ZU1UUXdZU013TDJrdk1tUnJaelZnTFMxa01UWnpjdyUzRCUzRCZ2dnBsPTEmbD0yMDI2MDgyOTEyMzgxN0VBODA3MEZDNkY3ODgzMzFBRTZGJmJ0YWc9ZTAwMGY4MDAwJnNocD1kMDViMTRiZCZzaGNwPS0iLCJmaWxlbmFtZSI6IlRpa1ZpZGVvLkFwcF83NDgwODk0MDI0MDgyMDUwMzA5Lm1wMyIsIm5iZiI6MTc4ODAwNzA5OCwiZXhwIjoxNzg4MDEwNjk4LCJpYXQiOjE3ODgwMDcwOTh9.Mlnl41loeWmReoQV6ajfB-7yecVqMB9Bz-VGU9pYr2k",
    "video": "https://dl.snapcdn.app/get?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1cmwiOiJodHRwczovL3YxNm0udGlrdG9rY2RuLXVzLmNvbS82OTI4OTA1ZTg5YmQyYTUwNjZiNDhmMGE1YzIwMjNmZi82YTkzMjcyZS92aWRlby90b3MvYWxpc2cvdG9zLWFsaXNnLXZlLTAwNjhjODAwLXNnL29JRUZWNVFRSjRBRlVFWGVHalJ0MTBmZ1NsRDZCQkVJUmdZbjhpLz9hPTEyMzMmYnRpPU9VQnpPVGc3UUdvNk9qWkFMM0FqTFRBellDTXhORE5nJiZidD04MjImZnQ9bkYuVGgwc3ExN1R2alNEWFlTeFJzdEFGTTZ-T0JCOUJaMW56WHRHJm1pbWVfdHlwZT12aWRlb19tcDQmcmM9T2pkb1pUbzFObVZsUERnN1pqczhhVUJwTTNCa04zUTVjbmh4ZVRNek56Y3pNMEF0TG1FdUxsNHRYelV4THk4MUxUUXZZU05wWlMxek1tUmpaalZnTFMxa01UWnpjdyUzRCUzRCZ2dnBsPTEmbD0yMDI2MDgyOTEyMzgxN0VBODA3MEZDNkY3ODgzMzFBRTZGJmJ0YWc9ZTAwMGI4MDAwIiwiZmlsZW5hbWUiOiJUaWtWaWRlby5BcHBfNzQ4MDg5NDAyNDA4MjA1MDMwOS5tcDQiLCJuYmYiOjE3ODgwMDcwOTgsImV4cCI6MTc4ODAxMDY5OCwiaWF0IjoxNzg4MDA3MDk4fQ.G3IP8MAOthwjXiGY9W4BWokVdqzNdDjtcYaCQcvow0I",
    "videoWM": "https://v16m.tiktokcdn-us.com/6928905e89bd2a5066b48f0a5c2023ff/6a93272e/video/tos/alisg/tos-alisg-ve-0068c800-sg/oIEFV5QQJ4AFUEXeGjRt10fgSlD6BBEIRgYn8i/?a=1233&bti=OUBzOTg7QGo6OjZAL3AjLTAzYCMxNDNg&&bt=822&ft=nF.Th0sq17TvjSDXYSxRstAFM6~OBB9BZ1nzXtG&mime_type=video_mp4&rc=OjdoZTo1NmVlPDg7Zjs8aUBpM3BkN3Q5cnhxeTMzNzczM0AtLmEuLl4tXzUxLy81LTQvYSNpZS1zMmRjZjVgLS1kMTZzcw%3D%3D&vvpl=1&l=20260829123817EA8070FC6F788331AE6F&btag=e000b8000"
  }
}