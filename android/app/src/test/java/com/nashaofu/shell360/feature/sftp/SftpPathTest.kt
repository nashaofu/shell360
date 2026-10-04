package com.nashaofu.shell360.feature.sftp

import org.junit.Assert.assertEquals
import org.junit.Test

class SftpPathTest {
    @Test
    fun normalizesRelativeAndTrailingSegments() {
        assertEquals("/", normalizeSftpPath(""))
        assertEquals("/", normalizeSftpPath("/"))
        assertEquals("/a/c", normalizeSftpPath("/a/b/../c/"))
        assertEquals("/a", normalizeSftpPath("a"))
        assertEquals("/a", normalizeSftpPath("/a/b/.."))
        assertEquals("/", normalizeSftpPath("/.."))
        assertEquals("/a/b", normalizeSftpPath("/./a/b"))
    }

    @Test
    fun resolvesParentDirectories() {
        assertEquals("/a", sftpDirname("/a/b"))
        assertEquals("/", sftpDirname("/a"))
        assertEquals("/", sftpDirname("/"))
    }

    @Test
    fun stripsPathSeparatorsFromFilenames() {
        assertEquals("notes.txt", sanitizeSftpFilename("no/tes.txt"))
        assertEquals("....", sanitizeSftpFilename("../.."))
    }

    @Test
    fun formatsSizesAcrossUnits() {
        assertEquals("512 B", formatSize(512))
        assertEquals("1.00 KB", formatSize(1024))
        assertEquals("1.00 MB", formatSize(1024L * 1024))
        assertEquals("1.50 GB", formatSize((1024L * 1024 * 1536)))
    }
}
