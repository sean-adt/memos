package test

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestContainerDataDirectoryUsesSharedRunnerTempAndCleansUp(t *testing.T) {
	root := t.TempDir()
	t.Setenv("RUNNER_TEMP", root)
	var directory string
	t.Run("fixture", func(t *testing.T) {
		directory = newContainerDataDir(t)
		require.Equal(t, root, filepath.Dir(directory))
		other := newContainerDataDir(t)
		require.NotEqual(t, directory, other)
		info, err := os.Stat(directory)
		require.NoError(t, err)
		if runtime.GOOS != "windows" {
			require.Equal(t, os.FileMode(0o700), info.Mode().Perm())
		}
		require.NoError(t, os.WriteFile(filepath.Join(directory, "fixture.db"), []byte("data"), 0o600))
	})
	_, err := os.Stat(directory)
	require.True(t, os.IsNotExist(err), "fixture cleanup must remove its database directory")
}

func TestContainerDataDirectoryWithoutRunnerTemp(t *testing.T) {
	t.Setenv("RUNNER_TEMP", "")
	directory := newContainerDataDir(t)
	info, err := os.Stat(directory)
	require.NoError(t, err)
	require.True(t, info.IsDir())
	require.NoError(t, os.WriteFile(filepath.Join(directory, "fixture.db"), []byte("data"), 0o600))
}
