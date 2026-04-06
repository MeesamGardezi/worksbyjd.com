#!/usr/bin/env node
/**
 * convert.js
 * One-time script: reads every HTML page and generates a corresponding EJS
 * view under views/, replacing the shared head/nav/footer with partial includes.
 *
 * Usage:  node convert.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── File manifest ─────────────────────────────────────────────────────────────
const files = [
  // Top-level pages
  { src: 'index.html',                                               dest: 'views/index.ejs',                                            activePage: 'home'       },
  { src: 'contact.html',                                             dest: 'views/contact.ejs',                                          activePage: 'contact'    },
  { src: 'services.html',                                            dest: 'views/services.ejs',                                         activePage: 'services'   },
  { src: 'painting-services.html',                                   dest: 'views/painting-services.ejs',                                activePage: 'services'   },
  { src: 'home-remodeling.html',                                     dest: 'views/home-remodeling.ejs',                                  activePage: 'services'   },
  { src: 'portfolio.html',                                           dest: 'views/portfolio.ejs',                                        activePage: 'portfolio'  },
  { src: 'about.html',                                               dest: 'views/about.ejs',                                            activePage: 'about'      },
  { src: 'faq.html',                                                 dest: 'views/faq.ejs',                                              activePage: 'faq'        },
  { src: 'warranty.html',                                            dest: 'views/warranty.ejs',                                         activePage: 'warranty'   },
  { src: 'better-together.html',                                     dest: 'views/better-together.ejs',                                  activePage: 'community'  },
  { src: 'career-opportunities.html',                                dest: 'views/career-opportunities.ejs',                             activePage: 'careers'    },
  { src: 'manchester-by-the-sea-home-remodeling-services.html',      dest: 'views/manchester-by-the-sea-home-remodeling-services.ejs',   activePage: 'manchester' },

  // Services sub-pages
  { src: 'services/kitchens.html',            dest: 'views/services/kitchens.ejs',            activePage: 'services' },
  { src: 'services/bathrooms.html',           dest: 'views/services/bathrooms.ejs',           activePage: 'services' },
  { src: 'services/outdoor-living.html',      dest: 'views/services/outdoor-living.ejs',      activePage: 'services' },
  { src: 'services/decking.html',             dest: 'views/services/decking.ejs',             activePage: 'services' },
  { src: 'services/windows-and-doors.html',   dest: 'views/services/windows-and-doors.ejs',   activePage: 'services' },
  { src: 'services/basement-and-attics.html', dest: 'views/services/basement-and-attics.ejs', activePage: 'services' },
  { src: 'services/full-house-remodel.html',  dest: 'views/services/full-house-remodel.ejs',  activePage: 'services' },

  // Portfolio sub-pages
  { src: 'portfolio/rockport-retreat.html',           dest: 'views/portfolio/rockport-retreat.ejs',           activePage: 'portfolio' },
  { src: 'portfolio/beverly-palmer-bathroom.html',    dest: 'views/portfolio/beverly-palmer-bathroom.ejs',    activePage: 'portfolio' },
  { src: 'portfolio/gloucester-cahill-bathroom.html', dest: 'views/portfolio/gloucester-cahill-bathroom.ejs', activePage: 'portfolio' },
  { src: 'portfolio/tewksbury-bathroom.html',         dest: 'views/portfolio/tewksbury-bathroom.ejs',         activePage: 'portfolio' },

  // About sub-pages
  { src: 'about/our-story.html',    dest: 'views/about/our-story.ejs',    activePage: 'about' },
  { src: 'about/meet-the-team.html',dest: 'views/about/meet-the-team.ejs',activePage: 'about' },
];

// ── Markers used to locate the page body ──────────────────────────────────────
const NAV_OFFSET_MARKER = '<div class="nav-offset"></div>';
const FOOTER_MARKER     = '<footer class="footer">';

// ── Conversion ────────────────────────────────────────────────────────────────
let ok = 0;
let errors = 0;

for (const file of files) {
  if (!fs.existsSync(file.src)) {
    console.error(`  SKIP  ${file.src} — file not found`);
    errors++;
    continue;
  }

  let html;
  try {
    html = fs.readFileSync(file.src, 'utf8');
  } catch (e) {
    console.error(`  ERR   ${file.src} — ${e.message}`);
    errors++;
    continue;
  }

  // Extract <title>
  const titleMatch = html.match(/<title>([\s\S]*?)<\/title>/);
  const title = titleMatch ? titleMatch[1].trim() : '';

  // Extract <meta name="description">
  const descMatch = html.match(/<meta name="description" content="([^"]*?)"/);
  const description = descMatch ? descMatch[1] : '';

  // Locate page body: everything between nav-offset and <footer …>
  const startIdx = html.indexOf(NAV_OFFSET_MARKER);
  const endIdx   = html.indexOf(FOOTER_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    console.error(`  ERR   ${file.src} — could not locate nav-offset or footer markers`);
    errors++;
    continue;
  }

  let body = html.slice(startIdx + NAV_OFFSET_MARKER.length, endIdx);

  // Strip .html from all root-relative internal links
  body = body.replace(/href="(\/[^"]*?)\.html"/g, 'href="$1"');

  // Trim leading blank lines but preserve trailing newline
  body = body.replace(/^\n+/, '\n');

  // Determine include prefix based on view depth (e.g. views/services/x.ejs → '../')
  const depthBelowViews = file.dest.split('/').length - 2; // 0 = top-level
  const prefix = depthBelowViews > 0 ? '../'.repeat(depthBelowViews) : '';

  // Build the EJS view
  const output = [
    '<!DOCTYPE html>',
    '<html lang="en">',
    `<%- include('${prefix}partials/head', { title: ${JSON.stringify(title)}, description: ${JSON.stringify(description)} }) %>`,
    '<body>',
    `<%- include('${prefix}partials/navbar', { activePage: '${file.activePage}' }) %>`,
    `<%- include('${prefix}partials/mobile-menu') %>`,
    '<div class="nav-offset"></div>',
    body.trimEnd(),
    '',
    `<%- include('${prefix}partials/footer') %>`,
  ].join('\n');

  // Write output
  fs.mkdirSync(path.dirname(file.dest), { recursive: true });
  fs.writeFileSync(file.dest, output, 'utf8');

  console.log(`  OK    ${file.dest}`);
  ok++;
}

console.log(`\nDone — ${ok} converted, ${errors} skipped/errored.`);
