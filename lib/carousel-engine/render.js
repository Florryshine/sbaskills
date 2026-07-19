// lib/carousel-engine/render.js
//
// PATCHED: original file called rename(oldPath, newPath) below without
// importing `rename` from fs/promises — only writeFile, mkdir, unlink,
// readdir, access were imported. That throws
// "ReferenceError: rename is not defined" the first time a non-PDF
// (png/jpeg) carousel is rendered. Fixed by adding `rename` to the import.
// No other logic changed.

import { spawn } from 'child_process';
import { writeFile, mkdir, unlink, readdir, access, rename } from 'fs/promises';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const TEMP_DIR = path.join(os.tmpdir(), 'sba-carousel');

/**
 * Renders a carousel from Markdown using Marp CLI via spawn.
 * @param {string} markdown - The Marp Markdown string.
 * @param {string} format - 'png', 'jpeg', or 'pdf'.
 * @returns {Promise<{ outputPath: string }>}
 */
export async function renderCarousel(markdown, format = 'png') {
  await mkdir(TEMP_DIR, { recursive: true });

  const id = uuidv4();
  const markdownPath = path.join(TEMP_DIR, `${id}.md`);
  const outputBase = path.join(TEMP_DIR, id);

  // Write the markdown to a temp file
  await writeFile(markdownPath, markdown, 'utf-8');

  // Verify the file exists
  try {
    await access(markdownPath);
  } catch (e) {
    throw new Error(`Failed to create markdown file: ${e.message}`);
  }

  return new Promise((resolve, reject) => {
    // Build arguments: include --no-stdin to avoid waiting for input
    let args;
    if (format === 'pdf') {
      args = [markdownPath, '--pdf', '--no-stdin', '-o', `${outputBase}.pdf`];
    } else {
      args = [markdownPath, '--images', format, '--image-scale', '2', '--no-stdin', '-o', outputBase];
    }

    console.log(`🖼️ Rendering carousel with: npx @marp-team/marp-cli ${args.join(' ')}`);

    const child = spawn('npx', ['@marp-team/marp-cli', ...args], {
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });

    child.on('close', async (code) => {
      if (code !== 0) {
        reject(new Error(`Marp CLI exited with code ${code}`));
        return;
      }

      console.log('✅ Render complete!');

      let renderedFiles = [];

      // For images, rename to .png and log
      if (format !== 'pdf') {
        try {
          const files = await readdir(TEMP_DIR);
          const imageFiles = files
            .filter(f => f.startsWith(id) && !f.endsWith('.md'))
            .sort();

          // Rename each file to have .png extension
          for (const file of imageFiles) {
            const oldPath = path.join(TEMP_DIR, file);
            const newPath = oldPath + '.png';
            await rename(oldPath, newPath);
            renderedFiles.push(newPath);
            console.log(`📸 Renamed: ${file} → ${file}.png`);
          }

          console.log(`✅ Generated ${imageFiles.length} images with .png extension`);
        } catch (e) {
          console.warn('Could not read/rename generated files:', e.message);
        }
      } else {
        renderedFiles = [`${outputBase}.pdf`];
      }

      // Clean up temp markdown file
      await unlink(markdownPath).catch(() => {});

      // renderedFiles added on top of the original return shape — additive,
      // doesn't break any existing caller that only reads outputPath.
      resolve({ outputPath: outputBase, files: renderedFiles });
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start Marp CLI: ${err.message}`));
    });
  });
}
