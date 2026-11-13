import { test } from "node:test";
import assert from "node:assert/strict";
import { extractPreviewImage, looksLikeThumbnail, pickFeedImage, upgradeImageUrl } from "../../src/lib/news/images.ts";

test("upgrades common thumbnail URLs to large versions", () => {
  assert.equal(upgradeImageUrl("https://etimg.example.com/thumb/msid-1,width-150,height-113,resizemode-75/a.jpg"), "https://etimg.example.com/thumb/msid-1,width-1200,height-904,resizemode-75/a.jpg");
  assert.equal(upgradeImageUrl("https://site.com/wp-content/uploads/2026/11/photo-150x150.jpg"), "https://site.com/wp-content/uploads/2026/11/photo.jpg");
  assert.equal(upgradeImageUrl("https://cdn.site.com/img.jpg?w=300&q=80"), "https://cdn.site.com/img.jpg?w=1200&q=80");
  assert.equal(upgradeImageUrl("https://cdn.site.com/big-1600x900.jpg"), "https://cdn.site.com/big-1600x900.jpg");
});

test("picks the widest media image", () => {
  const url = pickFeedImage({ mediaContent: [{ $: { url: "https://a.com/s.jpg", width: "300" } }, { $: { url: "https://a.com/l.jpg", width: "1600" } }] });
  assert.equal(url, "https://a.com/l.jpg");
});

test("reads og:image and ignores logos", () => {
  assert.equal(extractPreviewImage('<meta property="og:image" content="/img/story.jpg">', "https://news.com/a/b"), "https://news.com/img/story.jpg");
  assert.equal(extractPreviewImage('<meta content="https://news.com/logo.png" property="og:image">', "https://news.com/a"), null);
});

test("flags thumbnail-looking URLs", () => {
  assert.equal(looksLikeThumbnail("https://x.com/thumb/a.jpg"), true);
  assert.equal(looksLikeThumbnail("https://x.com/photos/story-hero.jpg"), false);
});
